import type { ProviderModel } from "@/lib/providers/base";

/** 每个服务商仅保留最新一个主版本档（如 Claude 4.7，不保留 3.5 / 4.6） */
export const MAX_VERSION_TIERS = 1;

/**
 * 从模型标识中解析主版本号，用于排序与分档。
 * 例：gpt-5.5→5.5, claude-opus-4.7→4.7, k2.6→2.6, deepseek-v4→4, o3→3
 */
export function extractPrimaryVersion(...parts: string[]): number {
  const text = parts.filter(Boolean).join(" ").toLowerCase();

  const rules: RegExp[] = [
    /\bgpt-(\d+(?:\.\d+)?)/,
    /\bclaude-(\d+(?:\.\d+)?)-(?:haiku|sonnet|opus)\b/,
    /\bclaude-(\d+)-(\d+)-(?:haiku|sonnet|opus)\b/,
    /\bclaude\s+(\d+(?:\.\d+)?)\b/,
    /\bclaude-(?:opus|sonnet|haiku)-(\d+(?:\.\d+)?)/,
    /\bgemini-(\d+(?:\.\d+)?)/,
    /\bgrok-(\d+(?:\.\d+)?)/,
    /\bdeepseek[_-]?v?(\d+)/,
    /\bk(\d+(?:\.\d+)?)/,
    /\bkimi-k(\d+(?:\.\d+)?)/,
    /\bminimax-m(\d+(?:\.\d+)?)/,
    /\bminimax-(\d+(?:\.\d+)?)/,
    /\bdoubao-(\d+(?:\.\d+)?)/,
    /\bo(\d+(?:\.\d+)?)(?:-mini|-pro)?\b/,
    /-v(\d+)\b/,
    /-(\d+(?:\.\d+)?)(?:-mini|-pro|-flash)?\b/,
  ];

  for (const re of rules) {
    const m = text.match(re);
    if (!m?.[1]) continue;
    const n =
      m[2] !== undefined
        ? parseFloat(`${m[1]}.${m[2]}`)
        : parseFloat(m[1]);
    if (!Number.isNaN(n) && n > 0) return n;
  }

  return 0;
}

function versionOf(model: ProviderModel): number {
  return extractPrimaryVersion(
    model.id,
    model.upstreamModel ?? "",
    model.name
  );
}

/**
 * 仅保留版本号最高的 N 个「版本档」下的模型（默认 N=1，仅最新一代）。
 * 同一档位可有多条（如 Claude Opus 4.7 + Sonnet 4.7）。
 */
export function limitToLatestVersionTiers(
  models: ProviderModel[],
  tierCount = MAX_VERSION_TIERS
): ProviderModel[] {
  const chatModels = models.filter((m) => !m.supportsImageGen);
  const imageModels = models.filter((m) => m.supportsImageGen);

  const tiers = [
    ...new Set(chatModels.map((m) => versionOf(m)).filter((v) => v > 0)),
  ].sort((a, b) => b - a);

  const allowed =
    tiers.length > 0
      ? new Set(tiers.slice(0, tierCount))
      : new Set<number>();

  const limitedChat =
    tiers.length > 0
      ? chatModels.filter((m) => allowed.has(versionOf(m)))
      : chatModels
          .slice()
          .sort((a, b) => versionOf(b) - versionOf(a))
          .slice(0, tierCount);

  // 图片模型单独保留 1 个最新（若有）
  const sortedImage = imageModels
    .slice()
    .sort((a, b) => versionOf(b) - versionOf(a));

  return [...limitedChat, ...sortedImage.slice(0, 1)];
}
