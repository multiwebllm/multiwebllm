import {
  BaseProvider,
  ChatOptions,
  ProviderConfig,
  ProviderModel,
  QuotaInfo,
  SSEChunk,
} from "./base";
import {
  dedupeProviderModels,
  extractModelList,
  fetchJsonWithTimeout,
  normalizeOfficialModel,
} from "@/lib/models/normalize";

export interface CustomEndpoints {
  chat?: string;
  models?: string;
}

function normalizePath(path: string, fallback: string): string {
  const raw = path.trim() || fallback;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export class CustomProvider extends BaseProvider {
  protected get baseUrl(): string {
    return (this.config.baseUrl || "").replace(/\/$/, "");
  }

  private get endpoints(): Required<CustomEndpoints> {
    const ep = this.config.authData.endpoints as CustomEndpoints | undefined;
    return {
      chat: normalizePath(ep?.chat ?? "", "/v1/chat/completions"),
      models: normalizePath(ep?.models ?? "", "/v1/models"),
    };
  }

  private buildHeaders(stream = false): Record<string, string> {
    const { authData } = this.config;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    };
    if (stream) headers.Accept = "text/event-stream";

    const accessToken = authData.accessToken as string | undefined;
    const token = authData.token as string | undefined;
    const apiKey = authData.apiKey as string | undefined;
    const bearer = accessToken || token || apiKey;
    if (bearer) {
      headers.Authorization = bearer.startsWith("Bearer ")
        ? bearer
        : `Bearer ${bearer}`;
    }

    const cookies = authData.cookies as Record<string, string> | string | undefined;
    if (cookies) headers.Cookie = this.parseCookies(cookies);

    return headers;
  }

  async chat(options: ChatOptions): Promise<ReadableStream<Uint8Array>> {
    if (options.stream === false) {
      return this.createSSEStream(() => this.collectNonStream(options));
    }
    return this.createSSEStream(() => this.streamOpenAI(options));
  }

  private async *collectNonStream(
    options: ChatOptions
  ): AsyncGenerator<SSEChunk> {
    const url = `${this.baseUrl}${this.endpoints.chat}`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.buildHeaders(false),
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        stream: false,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      yield { error: `Upstream returned ${response.status}: ${text.slice(0, 200)}` };
      return;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    if (content) yield { content };
    yield { finishReason: "stop" };
  }

  private async *streamOpenAI(
    options: ChatOptions
  ): AsyncGenerator<SSEChunk> {
    const url = `${this.baseUrl}${this.endpoints.chat}`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.buildHeaders(true),
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        stream: true,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      yield { error: `Upstream returned ${response.status}: ${text.slice(0, 200)}` };
      return;
    }

    if (!response.body) {
      yield { error: "No response body from upstream" };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        yield { finishReason: "stop" };
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") {
          yield { finishReason: "stop" };
          return;
        }
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{
              delta?: { content?: string };
              finish_reason?: string | null;
            }>;
            error?: { message?: string };
          };
          if (parsed.error?.message) {
            yield { error: parsed.error.message };
            return;
          }
          const choice = parsed.choices?.[0];
          if (choice?.delta?.content) {
            yield { content: choice.delta.content };
          }
          if (choice?.finish_reason) {
            yield { finishReason: choice.finish_reason };
          }
        } catch {
          // skip malformed chunk
        }
      }
    }
  }

  async checkQuota(): Promise<QuotaInfo> {
    return {};
  }

  async validateAuth(): Promise<boolean> {
    const url = `${this.baseUrl}${this.endpoints.models}`;
    const data = await fetchJsonWithTimeout(url, {
      headers: this.buildHeaders(false),
    });
    if (data) return true;

    try {
      const res = await fetch(this.baseUrl, {
        method: "HEAD",
        headers: this.buildHeaders(false),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async fetchModels(): Promise<ProviderModel[]> {
    const url = `${this.baseUrl}${this.endpoints.models}`;
    const data = await fetchJsonWithTimeout(url, {
      headers: this.buildHeaders(false),
    });
    if (!data) return [];

    const slug =
      (this.config.authData._providerSlug as string | undefined) || "custom";
    const items = extractModelList(data);
    const models = items
      .map((item) => normalizeOfficialModel(slug, item))
      .filter((m): m is ProviderModel => m !== null);

    return dedupeProviderModels(models);
  }
}

export function customProviderConfig(
  slug: string,
  config: ProviderConfig
): ProviderConfig {
  return {
    ...config,
    authData: { ...config.authData, _providerSlug: slug },
  };
}
