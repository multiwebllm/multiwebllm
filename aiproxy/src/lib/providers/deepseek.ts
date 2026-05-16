import {
  BaseProvider,
  ChatOptions,
  QuotaInfo,
  SSEChunk,
  ProviderModel,
} from "./base";

function resolveDeepSeekModelClass(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("r1") || m.includes("reasoner")) return "deepseek_r1";
  if (m.includes("v4") || m.includes("_v4")) return "deepseek_v4";
  if (m === "deepseek_chat" || m === "deepseek_v3" || m.includes("chat")) {
    return "deepseek_chat";
  }
  return model;
}

export class DeepSeekProvider extends BaseProvider {
  private get baseUrl() {
    return this.config.baseUrl || "https://chat.deepseek.com";
  }

  private get headers() {
    const cookies = this.config.authData.cookies as Record<string, string> | string;
    const token = this.config.authData.token as string | undefined;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (cookies) {
      headers["Cookie"] = this.parseCookies(cookies);
    }
    return headers;
  }

  async chat(options: ChatOptions): Promise<ReadableStream<Uint8Array>> {
    return this.createSSEStream(() => this.streamChat(options));
  }

  private async *streamChat(options: ChatOptions): AsyncGenerator<SSEChunk> {
      const modelClass = resolveDeepSeekModelClass(options.model);

      const body = {
        message: options.messages[options.messages.length - 1]?.content || "",
        stream: true,
        model_preference: null,
        model_class: modelClass,
        temperature: options.temperature ?? 0,
      };

      const response = await fetch(
        `${this.baseUrl}/api/v0/chat/completions`,
        {
          method: "POST",
          headers: this.headers,
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        yield { error: `DeepSeek returned ${response.status}` };
        return;
      }

      const reader = response.body!.getReader();
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
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            yield { finishReason: "stop" };
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content =
              parsed.choices?.[0]?.delta?.content ||
              parsed.choices?.[0]?.message?.content;
            if (content) {
              yield { content };
            }
          } catch {
            // skip non-JSON lines
          }
        }
      }
  }

  async checkQuota(): Promise<QuotaInfo> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v0/users/current`, {
        headers: this.headers,
      });
      if (response.ok) {
        const data = await response.json();
        return {
          raw: data,
          remaining: undefined,
        };
      }
    } catch {
      // quota check failed
    }
    return {};
  }

  async validateAuth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v0/users/current`, {
        headers: this.headers,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async fetchModels(): Promise<ProviderModel[]> {
    const { fetchDeepSeekModels } = await import("@/lib/models/fetch-official");
    return fetchDeepSeekModels(this.config, this.baseUrl);
  }
}
