import {
  BaseProvider,
  ChatOptions,
  QuotaInfo,
  SSEChunk,
  ProviderModel,
} from "./base";

export class KimiProvider extends BaseProvider {
  private get baseUrl() {
    return this.config.baseUrl || "https://kimi.moonshot.cn";
  }

  private get headers() {
    const cookies = this.config.authData.cookies as Record<string, string> | string;
    const token = this.config.authData.token as string | undefined;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "R-Timezone": "Asia/Shanghai",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (cookies) {
      headers["Cookie"] = this.parseCookies(cookies);
    }
    return headers;
  }

  private async refreshToken(): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/token/refresh`, {
        method: "GET",
        headers: this.headers,
      });
      if (response.ok) {
        const data = await response.json();
        return data.access_token || data.refresh_token || null;
      }
    } catch {
      // refresh failed
    }
    return null;
  }

  async chat(options: ChatOptions): Promise<ReadableStream<Uint8Array>> {
    const self = this;

    return this.createSSEStream(async function* (): AsyncGenerator<SSEChunk> {
      // Create a new conversation
      const createRes = await fetch(`${self.baseUrl}/api/chat`, {
        method: "POST",
        headers: self.headers,
        body: JSON.stringify({
          name: "AIProxy Chat",
          is_example: false,
        }),
      });

      if (!createRes.ok) {
        yield { error: `Kimi create chat failed: ${createRes.status}` };
        return;
      }

      const chatData = await createRes.json();
      const chatId = chatData.id;

      const userMessage =
        typeof options.messages[options.messages.length - 1]?.content === "string"
          ? options.messages[options.messages.length - 1].content
          : JSON.stringify(options.messages[options.messages.length - 1]?.content);

      const response = await fetch(
        `${self.baseUrl}/api/chat/${chatId}/completion/stream`,
        {
          method: "POST",
          headers: {
            ...self.headers,
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: userMessage,
              },
            ],
            refs: [],
            use_search: false,
          }),
        }
      );

      if (!response.ok) {
        yield { error: `Kimi returned ${response.status}` };
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
            if (parsed.event === "cmpl" && parsed.text) {
              yield { content: parsed.text };
            }
          } catch {
            // skip
          }
        }
      }
    });
  }

  async checkQuota(): Promise<QuotaInfo> {
    try {
      const response = await fetch(`${this.baseUrl}/api/user`, {
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
      const response = await fetch(`${this.baseUrl}/api/user`, {
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
        id: "kimi-k1.5",
        name: "Kimi K1.5",
        description: "Moonshot's multimodal model with long-context reasoning",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 4096,
        contextWindow: 256000,
      },
      {
        id: "kimi-k2",
        name: "Kimi K2",
        description: "1T parameter MoE model for coding and agentic tasks",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 4096,
        contextWindow: 256000,
      },
      {
        id: "kimi-k2.5",
        name: "Kimi K2.5",
        description: "Trillion-parameter native multimodal model",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 4096,
        contextWindow: 256000,
      },
      {
        id: "kimi-k2.6",
        name: "Kimi K2.6",
        description: "Moonshot K2.6 - 增强推理与长上下文",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 8192,
        contextWindow: 256000,
      },
    ];
  }
}
