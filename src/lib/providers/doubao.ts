import {
  BaseProvider,
  ChatOptions,
  QuotaInfo,
  SSEChunk,
  ProviderModel,
} from "./base";

export class DouBaoProvider extends BaseProvider {
  private get baseUrl() {
    return this.config.baseUrl || "https://www.doubao.com";
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

      // Create a new conversation
      const createRes = await fetch(
        `${self.baseUrl}/alice/api/conversation/create`,
        {
          method: "POST",
          headers: self.headers,
          body: JSON.stringify({}),
        }
      );

      let conversationId = "";
      if (createRes.ok) {
        const data = await createRes.json();
        conversationId = data.data?.conversation_id || "";
      }

      const response = await fetch(
        `${self.baseUrl}/alice/api/conversation/chat`,
        {
          method: "POST",
          headers: {
            ...self.headers,
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            messages: [{ role: "user", content: userMessage }],
            stream: true,
            section_id: crypto.randomUUID(),
          }),
        }
      );

      if (!response.ok) {
        yield { error: `DouBao returned ${response.status}` };
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
              parsed.data?.text ||
              parsed.event_data?.text ||
              parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield { content };
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
      const response = await fetch(
        `${this.baseUrl}/alice/api/user/info`,
        { headers: this.headers }
      );
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
      const response = await fetch(
        `${this.baseUrl}/alice/api/user/info`,
        { headers: this.headers }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async fetchModels(): Promise<ProviderModel[]> {
    return [
      {
        id: "doubao-pro",
        name: "Doubao Pro",
        description: "ByteDance's professional large language model",
        supportsVision: false,
        supportsImageGen: false,
        maxTokens: 4096,
        contextWindow: 256000,
      },
      {
        id: "doubao-lite",
        name: "Doubao Lite",
        description: "Lightweight model for fast responses",
        supportsVision: false,
        supportsImageGen: false,
        maxTokens: 4096,
        contextWindow: 128000,
      },
      {
        id: "doubao-1.5-pro",
        name: "Doubao 1.5 Pro",
        description: "Third-generation MoE architecture model",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 4096,
        contextWindow: 256000,
      },
      {
        id: "doubao-1.5-pro-256k",
        name: "Doubao 1.5 Pro 256K",
        description: "Extended context version of Doubao 1.5 Pro",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 4096,
        contextWindow: 256000,
      },
      {
        id: "doubao-seed-code",
        name: "Doubao Seed Code",
        description: "Specialized model for agentic coding tasks",
        supportsVision: false,
        supportsImageGen: false,
        maxTokens: 4096,
        contextWindow: 256000,
      },
    ];
  }
}
