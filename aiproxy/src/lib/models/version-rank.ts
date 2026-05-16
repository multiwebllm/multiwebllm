import type { ProviderModel } from "@/lib/providers/base";
import {
  effectiveModelKind,
  MAX_MODELS_BY_KIND,
  MODEL_KINDS,
  type ModelKind,
} from "./model-kind";

/** 每个服务商聊天类仅保留最新一个主版本档（如 Claude Opus 4.7，不保留 4.6 / 4.5） */
export const MAX_VERSION_TIERS = 1;

/**
 * 从模型标识中解析主版本号，用于排序与分档。
 * 例：gpt-5.5→5.5, claude-opus-4.7→4.7, gpt-image-2→2, k2.6→2.6
 */
export function extractPrimaryVersion(...parts: string[]): number {
  const text = parts.filter(Boolean).join(" ").toLowerCase();

  const rules: RegExp[] = [
    /\bgpt-image-(\d+(?:\.\d+)?)/,
    /\bgpt-(\d+(?:\.\d+)?)/,
    /\bclaude-(\d+(?:\.\d+)?)-(?:haiku|sonnet|opus)\b/,
    /\bclaude-(\d+)-(\d+)-(?:haiku|sonnet|opus)\b/,
    /\bclaude\s+(\d+(?:\.\d+)?)\b/,
    /\bclaude-(?:opus|sonnet|haiku)-(\d+(?:\.\d+)?)/,
    /\bgemini-(\d+(?:\.\d+)?)/,
    /\bgrok-(\d+(?:\.\d+)?)/,
    /\bveo-(\d+(?:\.\d+)?)/,
    /\bimagen-(\d+(?:\.\d+)?)/,
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

function claudeProductLine(model: ProviderModel): string {
  const text = `${model.id} ${model.upstreamModel ?? ""} ${model.name}`.toLowerCase();
  if (text.includes("opus")) return "opus";
  if (text.includes("sonnet")) return "sonnet";
  if (text.includes("haiku")) return "haiku";
  return "other";
}

function isClaudeModel(model: ProviderModel): boolean {
  const text = `${model.id} ${model.upstreamModel ?? ""}`.toLowerCase();
  return text.includes("claude");
}

/** Opus 4.7 与 Sonnet 4.6 同属当前一代，各产品线保留最新一条 */
function limitClaudeChatByLine(chatModels: ProviderModel[]): ProviderModel[] {
  const claudeOnly = chatModels.filter(isClaudeModel);
  if (claudeOnly.length === 0) return [];

  const byLine = new Map<string, ProviderModel>();
  for (const m of claudeOnly) {
    const line = claudeProductLine(m);
    const prev = byLine.get(line);
    if (!prev || versionOf(m) >= versionOf(prev)) {
      byLine.set(line, m);
    }
  }
  return [...byLine.values()];
}

function limitChatByVersionTier(
  chatModels: ProviderModel[],
  tierCount: number
): ProviderModel[] {
  const claudeModels = chatModels.filter(isClaudeModel);
  const nonClaude = chatModels.filter((m) => !isClaudeModel(m));

  const keptClaude = limitClaudeChatByLine(claudeModels);

  const tiers = [
    ...new Set(nonClaude.map((m) => versionOf(m)).filter((v) => v > 0)),
  ].sort((a, b) => b - a);

  const allowed =
    tiers.length > 0
      ? new Set(tiers.slice(0, tierCount))
      : new Set<number>();

  let keptOther: ProviderModel[];
  if (tiers.length > 0) {
    keptOther = nonClaude.filter((m) => allowed.has(versionOf(m)));
  } else {
    keptOther = nonClaude
      .slice()
      .sort((a, b) => versionOf(b) - versionOf(a))
      .slice(0, tierCount);
  }

  return [...keptClaude, ...keptOther];
}

function pickLatestByVersion(
  models: ProviderModel[],
  count: number
): ProviderModel[] {
  if (models.length <= count) return models;
  return models
    .slice()
    .sort((a, b) => versionOf(b) - versionOf(a))
    .slice(0, count);
}

/**
 * 按模型类型分别裁剪：聊天保留最新主版本档；图片/视频/音频/代码各保留若干最新条。
 */
export function limitToLatestVersionTiers(
  models: ProviderModel[],
  tierCount = MAX_VERSION_TIERS
): ProviderModel[] {
  const byKind = new Map<ModelKind, ProviderModel[]>();
  for (const kind of MODEL_KINDS) {
    byKind.set(kind, []);
  }
  for (const m of models) {
    const kind = effectiveModelKind(m);
    byKind.get(kind)!.push(m);
  }

  const result: ProviderModel[] = [];

  const chatModels = byKind.get("chat") ?? [];
  if (chatModels.length > 0) {
    result.push(...limitChatByVersionTier(chatModels, tierCount));
  }

  for (const kind of MODEL_KINDS) {
    if (kind === "chat") continue;
    const subset = byKind.get(kind) ?? [];
    if (subset.length === 0) continue;
    const max = MAX_MODELS_BY_KIND[kind];
    result.push(...pickLatestByVersion(subset, max));
  }

  return result;
}
