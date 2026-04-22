import {
  BaseProvider,
  ChatOptions,
  QuotaInfo,
  SSEChunk,
  ProviderModel,
} from "./base";

export class GrokProvider extends BaseProvider {
  private get baseUrl() {
    return this.config.baseUrl || "https://grok.com";
  }

  private get headers() {
    const cookies = this.config.authData.cookies as Record<string, string> | string;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    };
    if (cookies) {
      headers["Cookie"] = this.parseCookies(cookies);
    }
    return headers;
  }

  async chat(options: ChatOptions): Promise<ReadableStream<Uint8Array>> {
    const self = this;

    return this.createSSEStream(async function* (): AsyncGenerator<SSEChunk> {
      const userMessage =
        typeof options.messages[options.messages.length - 1]?.content === "string"
          ? options.messages[options.messages.length - 1].content
          : JSON.stringify(options.messages[options.messages.length - 1]?.content);

      const response = await fetch(
        `${self.baseUrl}/rest/app-chat/conversations/new`,
        {
          method: "POST",
          headers: self.headers,
          body: JSON.stringify({
            temporary: true,
            modelSlug: "grok-3",
            message: userMessage,
          }),
        }
      );

      if (!response.ok) {
        yield { error: `Grok returned ${response.status}` };
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
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.result?.response?.text) {
              yield { content: parsed.result.response.text };
            } else if (parsed.result?.response?.token) {
              yield { content: parsed.result.response.token };
            }
          } catch {
            // skip non-JSON
          }
        }
      }
    });
  }

  async checkQuota(): Promise<QuotaInfo> {
    try {
      const response = await fetch(`${this.baseUrl}/rest/rate-limits`, {
        headers: this.headers,
      });
      if (response.ok) {
        const data = await response.json();
        return { raw: data };
      }
    } catch {
      // failed
    }
    return {};
  }

  async validateAuth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/rest/app-chat/conversations`, {
        headers: this.headers,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async fetchModels(): Promise<ProviderModel[]> {
    return [
      {
        id: "grok-2",
        name: "Grok 2",
        description: "xAI's general-purpose conversational AI",
        supportsVision: false,
        supportsImageGen: false,
        maxTokens: 4096,
        contextWindow: 128000,
      },
      {
        id: "grok-2-vision",
        name: "Grok 2 Vision",
        description: "Grok 2 with vision capabilities",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 4096,
        contextWindow: 128000,
      },
      {
        id: "grok-3",
        name: "Grok 3",
        description: "Advanced reasoning model",
        supportsVision: false,
        supportsImageGen: false,
        maxTokens: 4096,
        contextWindow: 128000,
      },
      {
        id: "grok-4",
        name: "Grok 4",
        description: "xAI's smartest model with native tool use",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 4096,
        contextWindow: 200000,
      },
      {
        id: "grok-4.1",
        name: "Grok 4.1",
        description: "Latest model with reduced hallucinations",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 4096,
        contextWindow: 200000,
      },
    ];
  }
}
