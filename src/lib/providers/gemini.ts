import {
  BaseProvider,
  ChatOptions,
  QuotaInfo,
  SSEChunk,
  ProviderModel,
} from "./base";

export class GeminiProvider extends BaseProvider {
  private get baseUrl() {
    return this.config.baseUrl || "https://gemini.google.com";
  }

  private get headers() {
    const cookies = this.config.authData.cookies as Record<string, string> | string;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "X-Same-Domain": "1",
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

      // Gemini web uses a complex protobuf-like API
      // This is a simplified version using the batchexecute endpoint
      const requestData = [
        [userMessage],
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        [],
      ];

      const formData = new URLSearchParams();
      formData.append(
        "f.req",
        JSON.stringify([null, JSON.stringify([requestData])])
      );
      formData.append("at", (self.config.authData.snlm0e as string) || "");

      const response = await fetch(
        `${self.baseUrl}/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate`,
        {
          method: "POST",
          headers: {
            ...self.headers,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        }
      );

      if (!response.ok) {
        yield { error: `Gemini returned ${response.status}` };
        return;
      }

      const text = await response.text();
      // Parse Gemini's response format (array of arrays)
      try {
        const lines = text.split("\n").filter((l) => l.trim());
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (Array.isArray(parsed) && parsed[0]?.[2]) {
              const innerData = JSON.parse(parsed[0][2]);
              const responseText = innerData[4]?.[0]?.[1]?.[0] || innerData[0]?.[0];
              if (responseText) {
                yield { content: responseText };
              }
            }
          } catch {
            // skip unparseable lines
          }
        }
      } catch {
        yield { error: "Failed to parse Gemini response" };
      }
      yield { finishReason: "stop" };
    });
  }

  async checkQuota(): Promise<QuotaInfo> {
    // Gemini doesn't expose quota via API for free/paid users
    return {};
  }

  async validateAuth(): Promise<boolean> {
    try {
      const response = await fetch(this.baseUrl, {
        headers: this.headers,
        redirect: "manual",
      });
      // If we get redirected to login, auth is invalid
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async fetchModels(): Promise<ProviderModel[]> {
    return [
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Advanced model for complex reasoning and coding",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 8192,
        contextWindow: 2000000,
      },
      {
        id: "gemini-1.5-flash",
        name: "Gemini 1.5 Flash",
        description: "Fast model for high-frequency tasks",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 8192,
        contextWindow: 1000000,
      },
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "Next-gen fast model with enhanced capabilities",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 8192,
        contextWindow: 1000000,
      },
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        description: "Most intelligent model with advanced reasoning",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 8192,
        contextWindow: 1000000,
      },
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        description: "Balanced cost and capability for production",
        supportsVision: true,
        supportsImageGen: false,
        maxTokens: 8192,
        contextWindow: 1000000,
      },
    ];
  }
}
