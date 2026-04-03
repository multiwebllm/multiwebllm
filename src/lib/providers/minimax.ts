import {
  BaseProvider,
  ChatOptions,
  QuotaInfo,
  SSEChunk,
} from "./base";

export class MinimaxProvider extends BaseProvider {
  private get baseUrl() {
    return this.config.baseUrl || "https://chat.minimax.io";
  }

  private get headers() {
    const cookies = this.config.authData.cookies as Record<string, string> | string;
    const token = this.config.authData.token as string | undefined;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
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
    const self = this;

    return this.createSSEStream(async function* (): AsyncGenerator<SSEChunk> {
      const userMessage =
        typeof options.messages[options.messages.length - 1]?.content === "string"
          ? options.messages[options.messages.length - 1].content
          : JSON.stringify(options.messages[options.messages.length - 1]?.content);

      // Create conversation first
      const createRes = await fetch(`${self.baseUrl}/api/chat/conversation`, {
        method: "POST",
        headers: self.headers,
        body: JSON.stringify({ name: "AIProxy" }),
      });

      let conversationId = "";
      if (createRes.ok) {
        const data = await createRes.json();
        conversationId = data.id || data.conversation_id || "";
      }

      const response = await fetch(
        `${self.baseUrl}/api/chat/completion/stream`,
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
          }),
        }
      );

      if (!response.ok) {
        yield { error: `Minimax returned ${response.status}` };
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
              parsed.data?.text ||
              parsed.text;
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
      const response = await fetch(`${this.baseUrl}/api/user/info`, {
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
      const response = await fetch(`${this.baseUrl}/api/user/info`, {
        headers: this.headers,
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
