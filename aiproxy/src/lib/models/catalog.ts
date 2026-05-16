/**
 * 模型目录：每个服务商维护当前最新主版本档的代表模型。
 * 同步时会与官网列表合并，再裁剪为仅保留最新 1 个主版本档。
 *
 * 仅包含网页订阅聊天（Cookie）服务商；DeepSeek / Minimax / 豆包等为开放平台 API，不走网页聊天同步。
 */
export interface CatalogModel {
  providerSlug: string;
  name: string;
  modelId: string;
  upstreamModel: string;
  maxTokens?: number;
  supportsVision?: boolean;
  supportsImageGen?: boolean;
}

/** 支持网页 Cookie 聊天的服务商（默认种子与模型同步范围） */
export const WEB_CHAT_PROVIDER_SLUGS = [
  "chatgpt",
  "claude",
  "gemini",
  "grok",
  "kimi",
] as const;

export type WebChatProviderSlug = (typeof WEB_CHAT_PROVIDER_SLUGS)[number];

export function isWebChatProvider(slug: string): slug is WebChatProviderSlug {
  return (WEB_CHAT_PROVIDER_SLUGS as readonly string[]).includes(slug);
}

export const MODEL_CATALOG: CatalogModel[] = [
  // ChatGPT — 5.5
  { providerSlug: "chatgpt", name: "GPT-5.5", modelId: "gpt-5.5", upstreamModel: "gpt-5.5", maxTokens: 256000, supportsVision: true },

  // Claude — 4.7（最新档：旗舰 + 主力）
  { providerSlug: "claude", name: "Claude Opus 4.7", modelId: "claude-opus-4.7", upstreamModel: "claude-opus-4-7-20260215", maxTokens: 1000000, supportsVision: true },
  { providerSlug: "claude", name: "Claude Sonnet 4.7", modelId: "claude-sonnet-4.7", upstreamModel: "claude-sonnet-4-7-20260215", maxTokens: 1000000, supportsVision: true },

  // Gemini (Google) — 2.5
  { providerSlug: "gemini", name: "Gemini 2.5 Pro", modelId: "gemini-2.5-pro", upstreamModel: "gemini-2.5-pro", maxTokens: 1000000, supportsVision: true },
  { providerSlug: "gemini", name: "Gemini 2.5 Flash", modelId: "gemini-2.5-flash", upstreamModel: "gemini-2.5-flash", maxTokens: 1000000, supportsVision: true },

  // Grok — 4.1
  { providerSlug: "grok", name: "Grok 4.1", modelId: "grok-4.1", upstreamModel: "grok-4.1", maxTokens: 200000, supportsVision: true },

  // Kimi — K2.6
  { providerSlug: "kimi", name: "Kimi K2.6", modelId: "kimi-k2.6", upstreamModel: "k2.6", maxTokens: 256000, supportsVision: true },
];

export function getCatalogForProvider(providerSlug: string): CatalogModel[] {
  if (!isWebChatProvider(providerSlug)) return [];
  return MODEL_CATALOG.filter((m) => m.providerSlug === providerSlug);
}

export function findCatalogEntry(
  providerSlug: string,
  officialId: string
): CatalogModel | undefined {
  if (!isWebChatProvider(providerSlug)) return undefined;
  const normalized = officialId.trim().toLowerCase();
  const entries = getCatalogForProvider(providerSlug);

  return (
    entries.find(
      (e) =>
        e.upstreamModel.toLowerCase() === normalized ||
        e.modelId.toLowerCase() === normalized
    ) ||
    entries.find(
      (e) =>
        normalized.includes(e.upstreamModel.toLowerCase()) ||
        e.upstreamModel.toLowerCase().includes(normalized)
    )
  );
}
