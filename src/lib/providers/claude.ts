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
        id: "claude-opus-4-7",
        name: "Claude Opus 4.7",
        description: "Anthropic 最强推理模型 (1M context)",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 32000,
        contextWindow: 1000000,
      },
      {
        id: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        description: "编码与代理任务首选, 性能与速度平衡 (1M context)",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 16000,
        contextWindow: 1000000,
      },
      {
        id: "claude-haiku-4-5",
        name: "Claude Haiku 4.5",
        description: "最快响应, 低成本高性价比",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 8192,
        contextWindow: 200000,
      },
      {
        id: "claude-opus-4",
        name: "Claude Opus 4",
        description: "Opus 4 上一代旗舰",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 8192,
        contextWindow: 200000,
      },
      {
        id: "claude-sonnet-4",
        name: "Claude Sonnet 4",
        description: "Sonnet 4 上一代",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 8192,
        contextWindow: 200000,
      },
    ];
  }
}
