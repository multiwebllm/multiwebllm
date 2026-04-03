export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface ContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface SSEChunk {
  content?: string;
  finishReason?: string | null;
  error?: string;
}

export interface QuotaInfo {
  total?: number;
  used?: number;
  remaining?: number;
  raw?: Record<string, unknown>;
}

export interface ProviderConfig {
  authData: Record<string, unknown>;
  baseUrl?: string;
}

export abstract class BaseProvider {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  abstract chat(options: ChatOptions): Promise<ReadableStream<Uint8Array>>;

  abstract checkQuota(): Promise<QuotaInfo>;

  abstract validateAuth(): Promise<boolean>;

  protected createSSEStream(
    generator: () => AsyncGenerator<SSEChunk>
  ): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const gen = generator();

    return new ReadableStream({
      async pull(controller) {
        try {
          const { value, done } = await gen.next();
          if (done) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }
          if (value.error) {
            controller.error(new Error(value.error));
            return;
          }
          const chunk = {
            id: `chatcmpl-${Date.now()}`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            choices: [
              {
                index: 0,
                delta: value.content ? { content: value.content } : {},
                finish_reason: value.finishReason || null,
              },
            ],
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
          );
        } catch (err) {
          controller.error(err);
        }
      },
    });
  }

  protected async fetchSSE(
    url: string,
    options: RequestInit
  ): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(url, options);

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new Error(`Provider returned ${response.status}: ${text}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    return response.body;
  }

  protected parseCookies(
    cookies: Record<string, string> | string
  ): string {
    if (typeof cookies === "string") return cookies;
    return Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  protected estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token for English, ~2 for Chinese
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }
}
