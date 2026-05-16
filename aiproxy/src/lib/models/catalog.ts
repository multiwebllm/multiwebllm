/**
 * 内置模型目录：各服务商 2026 年在用代表模型（聊天 / 图片 / 视频 / 音频 / 代码）。
 * 同步时与官网列表合并；目录条目全部保留，官网仅补充账号可用项并过滤已下线旧版。
 */
import type { ModelKind } from "./model-kind";
import { CURRENT_MODEL_YEAR } from "./model-year";

export interface CatalogModel {
  providerSlug: string;
  name: string;
  modelId: string;
  upstreamModel: string;
  modelKind?: ModelKind;
  releaseYear?: number;
  maxTokens?: number | null;
  contextWindow?: number | null;
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

export const REMOVED_PROVIDER_SLUGS = [
  "deepseek",
  "minimax",
  "doubao",
] as const;

export function isRemovedProvider(slug: string): boolean {
  return (REMOVED_PROVIDER_SLUGS as readonly string[]).includes(slug);
}

export function isCustomProvider(slug: string): boolean {
  return !isWebChatProvider(slug) && !isRemovedProvider(slug);
}

export function isSyncableProvider(slug: string): boolean {
  return isWebChatProvider(slug) || isCustomProvider(slug);
}

export function validateCustomProviderSlug(slug: string): string | null {
  const s = slug.trim().toLowerCase();
  if (!s) return "请填写标识";
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(s)) {
    return "标识仅支持小写字母、数字、连字符和下划线";
  }
  if (isWebChatProvider(s)) {
    return "该标识为内置服务商，请从预设列表选择";
  }
  if (isRemovedProvider(s)) {
    return "该标识已停用，请使用其它名称";
  }
  return null;
}

const Y = CURRENT_MODEL_YEAR;

export const MODEL_CATALOG: CatalogModel[] = [
  // —— ChatGPT（2026 聊天主力：5.2 Instant ~ 5.5，见 OpenAI 发布说明）——
  {
    providerSlug: "chatgpt",
    name: "GPT-5.5",
    modelId: "gpt-5.5",
    upstreamModel: "gpt-5.5",
    modelKind: "chat",
    releaseYear: Y,
    contextWindow: 1000000,
    maxTokens: 128000,
    supportsVision: true,
  },
  {
    providerSlug: "chatgpt",
    name: "GPT-5.5 Pro",
    modelId: "gpt-5.5-pro",
    upstreamModel: "gpt-5.5-pro",
    modelKind: "chat",
    releaseYear: Y,
    contextWindow: 1000000,
    maxTokens: 128000,
    supportsVision: true,
  },
  {
    providerSlug: "chatgpt",
    name: "GPT-5.4",
    modelId: "gpt-5.4",
    upstreamModel: "gpt-5.4",
    modelKind: "chat",
    releaseYear: Y,
    contextWindow: 1000000,
    maxTokens: 128000,
    supportsVision: true,
  },
  {
    providerSlug: "chatgpt",
    name: "GPT-5.4 Thinking",
    modelId: "gpt-5.4-thinking",
    upstreamModel: "gpt-5.4-thinking",
    modelKind: "chat",
    releaseYear: Y,
    contextWindow: 1000000,
    maxTokens: 128000,
    supportsVision: true,
  },
  {
    providerSlug: "chatgpt",
    name: "GPT-5.4 Pro",
    modelId: "gpt-5.4-pro",
    upstreamModel: "gpt-5.4-pro",
    modelKind: "chat",
    releaseYear: Y,
    contextWindow: 1000000,
    maxTokens: 128000,
    supportsVision: true,
  },
  {
    providerSlug: "chatgpt",
    name: "GPT-5.4 mini",
    modelId: "gpt-5.4-mini",
    upstreamModel: "gpt-5.4-mini",
    modelKind: "chat",
    releaseYear: Y,
    contextWindow: 400000,
    maxTokens: 128000,
    supportsVision: true,
  },
  {
    providerSlug: "chatgpt",
    name: "GPT-5.4 nano",
    modelId: "gpt-5.4-nano",
    upstreamModel: "gpt-5.4-nano",
    modelKind: "chat",
    releaseYear: Y,
    contextWindow: 128000,
    maxTokens: 32000,
    supportsVision: true,
  },
  {
    providerSlug: "chatgpt",
    name: "GPT-5.3 Instant",
    modelId: "gpt-5.3-instant",
    upstreamModel: "gpt-5.3-instant",
    modelKind: "chat",
    releaseYear: Y,
    contextWindow: 256000,
    maxTokens: 32768,
    supportsVision: true,
  },
  {
    providerSlug: "chatgpt",
    name: "GPT-5.2 Instant",
    modelId: "gpt-5.2-instant",
    upstreamModel: "gpt-5.2-instant",
    modelKind: "chat",
    releaseYear: Y,
    contextWindow: 256000,
    maxTokens: 32768,
    supportsVision: true,
  },
  {
    providerSlug: "chatgpt",
    name: "GPT Image 2",
    modelId: "gpt-image-2",
    upstreamModel: "gpt-image-2",
    modelKind: "image",
    releaseYear: Y,
    supportsImageGen: true,
  },
  {
    providerSlug: "chatgpt",
    name: "GPT Image 1.5",
    modelId: "gpt-image-1.5",
    upstreamModel: "gpt-image-1.5",
    modelKind: "image",
    releaseYear: Y,
    supportsImageGen: true,
  },
  {
    providerSlug: "chatgpt",
    name: "Sora",
    modelId: "sora",
    upstreamModel: "sora",
    modelKind: "video",
    releaseYear: Y,
  },
  {
    providerSlug: "chatgpt",
    name: "Codex",
    modelId: "codex",
    upstreamModel: "codex",
    modelKind: "code",
    releaseYear: Y,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    providerSlug: "chatgpt",
    name: "GPT-5.3 Codex",
    modelId: "gpt-5.3-codex",
    upstreamModel: "gpt-5.3-codex",
    modelKind: "code",
    releaseYear: Y,
    contextWindow: 200000,
    maxTokens: 32768,
  },
  {
    providerSlug: "chatgpt",
    name: "GPT-4o mini TTS",
    modelId: "gpt-4o-mini-tts",
    upstreamModel: "gpt-4o-mini-tts",
    modelKind: "audio",
    releaseYear: Y,
  },

  // —— Claude（2026）——
  {
    providerSlug: "claude",
    name: "Claude Opus 4.7",
    modelId: "claude-opus-4.7",
    upstreamModel: "claude-opus-4-7",
    modelKind: "chat",
    releaseYear: Y,
    contextWindow: 1000000,
    maxTokens: 128000,
    supportsVision: true,
  },
  {
    providerSlug: "claude",
    name: "Claude Sonnet 4.6",
    modelId: "claude-sonnet-4.6",
    upstreamModel: "claude-sonnet-4-6",
    modelKind: "chat",
    releaseYear: Y,
    contextWindow: 1000000,
    maxTokens: 64000,
    supportsVision: true,
  },
  {
    providerSlug: "claude",
    name: "Claude Haiku 4.5",
    modelId: "claude-haiku-4.5",
    upstreamModel: "claude-haiku-4-5",
    modelKind: "chat",
    releaseYear: Y,
    contextWindow: 200000,
    maxTokens: 64000,
    supportsVision: true,
  },
  {
    providerSlug: "claude",
    name: "Claude Code",
    modelId: "claude-code",
    upstreamModel: "claude-code",
    modelKind: "code",
    releaseYear: Y,
    contextWindow: 200000,
    maxTokens: 32768,
  },

  // —— Gemini（2026）——
  {
    providerSlug: "gemini",
    name: "Gemini 2.5 Pro",
    modelId: "gemini-2.5-pro",
    upstreamModel: "gemini-2.5-pro",
    modelKind: "chat",
    releaseYear: Y,
    contextWindow: 1048576,
    maxTokens: 8192,
    supportsVision: true,
  },
  {
    providerSlug: "gemini",
    name: "Gemini 2.5 Flash",
    modelId: "gemini-2.5-flash",
    upstreamModel: "gemini-2.5-flash",
    modelKind: "chat",
    releaseYear: Y,
    contextWindow: 1048576,
    maxTokens: 8192,
    supportsVision: true,
  },
  {
    providerSlug: "gemini",
    name: "Gemini 2.5 Flash-Lite",
    modelId: "gemini-2.5-flash-lite",
    upstreamModel: "gemini-2.5-flash-lite",
    modelKind: "chat",
    releaseYear: Y,
    contextWindow: 1048576,
    maxTokens: 8192,
    supportsVision: true,
  },
  {
    providerSlug: "gemini",
    name: "Imagen 3",
    modelId: "imagen-3",
    upstreamModel: "imagen-3.0-generate-002",
    modelKind: "image",
    releaseYear: Y,
    supportsImageGen: true,
  },
  {
    providerSlug: "gemini",
    name: "Veo 3",
    modelId: "veo-3",
    upstreamModel: "veo-3.0-generate-001",
    modelKind: "video",
    releaseYear: Y,
  },

  // —— Grok（2026）——
  {
    providerSlug: "grok",
    name: "Grok 4.1",
    modelId: "grok-4.1",
    upstreamModel: "grok-4.1",
    modelKind: "chat",
    releaseYear: Y,
    contextWindow: 131072,
    maxTokens: 16384,
    supportsVision: true,
  },
  {
    providerSlug: "grok",
    name: "Grok 4.1 Fast",
    modelId: "grok-4.1-fast",
    upstreamModel: "grok-4.1-fast",
    modelKind: "chat",
    releaseYear: Y,
    contextWindow: 131072,
    maxTokens: 16384,
    supportsVision: true,
  },
  {
    providerSlug: "grok",
    name: "Grok Imagine",
    modelId: "grok-imagine-image",
    upstreamModel: "grok-imagine-image",
    modelKind: "image",
    releaseYear: Y,
    supportsImageGen: true,
  },
  {
    providerSlug: "grok",
    name: "Grok Imagine Quality",
    modelId: "grok-imagine-image-quality",
    upstreamModel: "grok-imagine-image-quality",
    modelKind: "image",
    releaseYear: Y,
    supportsImageGen: true,
  },
  {
    providerSlug: "grok",
    name: "Grok Imagine Video",
    modelId: "grok-imagine-video",
    upstreamModel: "grok-imagine-video",
    modelKind: "video",
    releaseYear: Y,
  },

  // —— Kimi（2026）——
  {
    providerSlug: "kimi",
    name: "Kimi K2.6",
    modelId: "kimi-k2.6",
    upstreamModel: "k2.6",
    modelKind: "chat",
    releaseYear: Y,
    contextWindow: 256000,
    maxTokens: 32768,
    supportsVision: true,
  },
  {
    providerSlug: "kimi",
    name: "Kimi K2.6 Thinking",
    modelId: "kimi-k2.6-thinking",
    upstreamModel: "k2.6-thinking",
    modelKind: "chat",
    releaseYear: Y,
    contextWindow: 256000,
    maxTokens: 32768,
    supportsVision: true,
  },
];

export function getCatalogForProvider(providerSlug: string): CatalogModel[] {
  if (!isWebChatProvider(providerSlug)) return [];
  return MODEL_CATALOG.filter((m) => m.providerSlug === providerSlug);
}

export function getCurrentYearCatalogForProvider(
  providerSlug: string,
  year = CURRENT_MODEL_YEAR
): CatalogModel[] {
  return getCatalogForProvider(providerSlug).filter(
    (m) => (m.releaseYear ?? year) >= year
  );
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
        e.upstreamModel.toLowerCase().includes(normalized) ||
        normalized.includes(e.modelId.toLowerCase()) ||
        e.modelId.toLowerCase().includes(normalized)
    )
  );
}

export function isCatalogModelId(
  providerSlug: string,
  model: Pick<{ id: string; upstreamModel?: string }, "id" | "upstreamModel">
): boolean {
  const id = model.id.toLowerCase();
  const up = (model.upstreamModel ?? model.id).toLowerCase();
  return getCatalogForProvider(providerSlug).some(
    (e) =>
      e.modelId.toLowerCase() === id ||
      e.upstreamModel.toLowerCase() === up ||
      e.upstreamModel.toLowerCase() === id ||
      e.modelId.toLowerCase() === up
  );
}
