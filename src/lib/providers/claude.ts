import {
  BaseProvider,
  ChatOptions,
  QuotaInfo,
  SSEChunk,
  ProviderModel,
} from "./base";

export class ClaudeProvider extends BaseProvider {
  private get baseUrl() {
    return this.config.baseUrl || "https://claude.ai";
  }

  private get headers() {
    const cookies = this.config.authData.cookies as Record<string, string> | string;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Anthropic-Client-Sha": "unknown",
      "Anthropic-Client-Version": "unknown",
    };
    if (cookies) {
      headers["Cookie"] = this.parseCookies(cookies);
    }
    return headers;
  }

  private async getOrgId(): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/organizations`, {
        headers: this.headers,
      });
      if (response.ok) {
        const orgs = await response.json();
        return orgs[0]?.uuid || null;
      }
    } catch {
      // failed
    }
    return this.config.authData.orgId as string || null;
  }

  async chat(options: ChatOptions): Promise<ReadableStream<Uint8Array>> {
    const self = this;

    return this.createSSEStream(async function* (): AsyncGenerator<SSEChunk> {
      const orgId = await self.getOrgId();
      if (!orgId) {
        yield { error: "Failed to get Claude organization ID" };
        return;
      }

      // Create conversation
      const createRes = await fetch(
        `${self.baseUrl}/api/organizations/${orgId}/chat_conversations`,
        {
          method: "POST",
          headers: self.headers,
          body: JSON.stringify({
            name: "",
            uuid: crypto.randomUUID(),
          }),
        }
      );

      if (!createRes.ok) {
        yield { error: `Claude create conversation failed: ${createRes.status}` };
        return;
      }

      const convData = await createRes.json();
      const convId = convData.uuid;

      const userMessage =
        typeof options.messages[options.messages.length - 1]?.content === "string"
          ? options.messages[options.messages.length - 1].content
          : JSON.stringify(options.messages[options.messages.length - 1]?.content);

      const response = await fetch(
        `${self.baseUrl}/api/organizations/${orgId}/chat_conversations/${convId}/completion`,
        {
          method: "POST",
          headers: {
            ...self.headers,
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            prompt: userMessage,
            timezone: "Asia/Shanghai",
            attachments: [],
            files: [],
          }),
        }
      );

      if (!response.ok) {
        yield { error: `Claude returned ${response.status}` };
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
            if (parsed.type === "completion" && parsed.completion) {
              yield { content: parsed.completion };
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
      const orgId = await this.getOrgId();
      if (!orgId) return {};
      const response = await fetch(
        `${this.baseUrl}/api/organizations/${orgId}/usage`,
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
    const orgId = await this.getOrgId();
    return !!orgId;
  }

  async fetchModels(): Promise<ProviderModel[]> {
    return [
      {
        id: "claude-3-opus",
        name: "Claude 3 Opus",
        description: "Anthropic's most powerful model for complex tasks",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 4096,
        contextWindow: 200000,
      },
      {
        id: "claude-3-sonnet",
        name: "Claude 3 Sonnet",
        description: "Balanced performance and speed",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 4096,
        contextWindow: 200000,
      },
      {
        id: "claude-3-haiku",
        name: "Claude 3 Haiku",
        description: "Fastest model for lightweight actions",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 4096,
        contextWindow: 200000,
      },
      {
        id: "claude-3.5-sonnet",
        name: "Claude 3.5 Sonnet",
        description: "Improved coding and reasoning capabilities",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 8192,
        contextWindow: 200000,
      },
      {
        id: "claude-3.5-haiku",
        name: "Claude 3.5 Haiku",
        description: "Fastest 3.5 model with near-frontier performance",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 4096,
        contextWindow: 200000,
      },
    ];
  }
}
