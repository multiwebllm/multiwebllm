import type { ModelKind } from "./model-kind";

/**
 * maxTokens：/v1/chat/completions 未传 max_tokens 时的默认「单次最大输出」上限。
 * contextWindow：模型上下文窗口（仅展示与同步落库，网页 Cookie 聊天上游未必读取该字段）。
 */
export interface ModelLimits {
  maxTokens: number | null;
  contextWindow: number | null;
}

/** 非聊天类不适用输出 Token 上限 */
export function defaultLimitsForKind(kind: ModelKind): ModelLimits {
  switch (kind) {
    case "chat":
      return { maxTokens: 16384, contextWindow: 128000 };
    case "code":
      return { maxTokens: 32768, contextWindow: 200000 };
    case "image":
    case "video":
    case "audio":
      return { maxTokens: null, contextWindow: null };
    default:
      return { maxTokens: 4096, contextWindow: 128000 };
  }
}

export function resolveModelLimits(
  kind: ModelKind,
  catalog?: Partial<ModelLimits>,
  official?: Partial<ModelLimits>
): ModelLimits {
  const defaults = defaultLimitsForKind(kind);

  let officialMax = official?.maxTokens;
  let officialCtx = official?.contextWindow;

  // 部分官网把上下文窗口填在 max_tokens 字段里
  if (
    officialMax != null &&
    officialMax > 100_000 &&
    (officialCtx == null || officialCtx === 0)
  ) {
    officialCtx = officialMax;
    officialMax = undefined;
  }

  const contextWindow =
    officialCtx ?? catalog?.contextWindow ?? defaults.contextWindow;

  let maxTokens =
    officialMax ?? catalog?.maxTokens ?? defaults.maxTokens;

  if (kind !== "chat" && kind !== "code") {
    maxTokens = null;
  }

  return { maxTokens, contextWindow };
}

export function formatTokenLimit(n: number | null | undefined): string {
  if (n == null || n <= 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return n.toLocaleString();
}
