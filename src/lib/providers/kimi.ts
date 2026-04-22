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

  // 检测授权数据形态:字符串 sk-xxx 或对象 {apiKey: "sk-xxx"} → 开放 API 模式
  private get openApiKey(): string | null {
    const data = this.config.authData as Record<string, unknown> | string | null | undefined;
    if (typeof data === "string") {
      return data.startsWith("sk-") ? data : null;
    }
    const k = data?.apiKey as string | undefined;
    return k && k.startsWith("sk-") ? k : null;
  }

  async chat(options: ChatOptions): Promise<ReadableStream<Uint8Array>> {
    // 开放 API 模式:OpenAI 兼容透传
    const apiKey = this.openApiKey;
    if (apiKey) {
      return this.chatViaOpenApi(options, apiKey);
    }

    // 网页版模式:逆向 kimi.moonshot.cn 登录态
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

  // OpenAI 兼容透传 (Kimi 开放 API / Coding API)
  // baseUrl 默认 https://api.kimi.com/coding/v1, 也支持用户自定义为 api.moonshot.cn/v1 等
  private get openApiBase(): string {
    const raw = this.config.baseUrl || "https://api.kimi.com/coding/v1";
    // 如果仍是网页版地址 (kimi.moonshot.cn), 自动切到 coding API
    if (/kimi\.moonshot\.cn/i.test(raw)) {
      return "https://api.kimi.com/coding/v1";
    }
    return raw.replace(/\/+$/, "");
  }

  private chatViaOpenApi(options: ChatOptions, apiKey: string): ReadableStream<Uint8Array> {
    const base = this.openApiBase;
    return this.createSSEStream(async function* (): AsyncGenerator<SSEChunk> {
      const upstream = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: options.model,
          messages: options.messages,
          stream: true,
          ...(options.temperature != null ? { temperature: options.temperature } : {}),
          ...(options.max_tokens != null ? { max_tokens: options.max_tokens } : {}),
        }),
      });

      if (!upstream.ok) {
        const txt = await upstream.text().catch(() => "");
        yield { error: `Kimi 开放 API ${upstream.status}: ${txt.slice(0, 400)}` };
        return;
      }

      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta;
            const finishReason = json.choices?.[0]?.finish_reason;
            if (delta?.content) yield { content: delta.content };
            if (finishReason) yield { finishReason };
          } catch {
            // 非标准行忽略
          }
        }
      }
    });
  }

  async checkQuota(): Promise<QuotaInfo> {
    // 开放 API 模式没有通用配额接口, 返回空
    if (this.openApiKey) return {};
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
    // 开放 API 模式: GET /models 能否拉到 200
    const apiKey = this.openApiKey;
    if (apiKey) {
      try {
        const res = await fetch(`${this.openApiBase}/models`, {
          headers: { "Authorization": `Bearer ${apiKey}` },
        });
        return res.ok;
      } catch {
        return false;
      }
    }
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
