import {
  BaseProvider,
  ChatOptions,
  QuotaInfo,
  SSEChunk,
  ProviderModel,
} from "./base";

export class ChatGPTProvider extends BaseProvider {
  private get baseUrl() {
    return this.config.baseUrl || "https://chatgpt.com";
  }

  private get headers() {
    const cookies = this.config.authData.cookies as Record<string, string> | string;
    const accessToken = this.config.authData.accessToken as string | undefined;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    };
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }
    if (cookies) {
      headers["Cookie"] = this.parseCookies(cookies);
    }
    return headers;
  }

  private async getAccessToken(): Promise<string | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/session`, {
        headers: this.headers,
      });
      if (response.ok) {
        const data = await response.json();
        return data.accessToken || null;
      }
    } catch {
      // failed to get access token
    }
    return this.config.authData.accessToken as string || null;
  }

  async chat(options: ChatOptions): Promise<ReadableStream<Uint8Array>> {
    return this.createSSEStream(() => this.streamChat(options));
  }

  private async *streamChat(options: ChatOptions): AsyncGenerator<SSEChunk> {
      let token = this.config.authData.accessToken as string;
      if (!token) {
        token = (await this.getAccessToken()) || "";
      }

      const messages = options.messages.map((m) => ({
        id: crypto.randomUUID(),
        author: { role: m.role },
        content: {
          content_type: "text",
          parts: [typeof m.content === "string" ? m.content : JSON.stringify(m.content)],
        },
      }));

      const body = {
        action: "next",
        messages,
        model: options.model,
        parent_message_id: crypto.randomUUID(),
        timezone_offset_min: -480,
        history_and_training_disabled: false,
      };

      const response = await fetch(
        `${this.baseUrl}/backend-api/conversation`,
        {
          method: "POST",
          headers: {
            ...this.headers,
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        yield { error: `ChatGPT returned ${response.status}` };
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let lastContent = "";

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
            const parts = parsed.message?.content?.parts;
            if (parts && parts.length > 0) {
              const fullContent = parts.join("");
              if (fullContent.length > lastContent.length) {
                const newContent = fullContent.slice(lastContent.length);
                lastContent = fullContent;
                yield { content: newContent };
              }
            }
          } catch {
            // skip
          }
        }
      }
  }

  async checkQuota(): Promise<QuotaInfo> {
    try {
      const token = await this.getAccessToken();
      if (!token) return {};
      const response = await fetch(
        `${this.baseUrl}/backend-api/accounts/check/v4-2023-04-27`,
        {
          headers: {
            ...this.headers,
            Authorization: `Bearer ${token}`,
          },
        }
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
    const token = await this.getAccessToken();
    return !!token;
  }

  async fetchModels(): Promise<ProviderModel[]> {
    const { fetchChatGPTModels } = await import("@/lib/models/fetch-official");
    return fetchChatGPTModels(this.config, this.baseUrl, () =>
      this.getAccessToken()
    );
  }
}
