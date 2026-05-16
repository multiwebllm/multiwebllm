import type { ProviderModel } from "@/lib/providers/base";

/** 已知应删除的 Kimi 旧版 model_id（精确匹配） */
export const KIMI_LEGACY_MODEL_IDS = new Set([
  "kimi-k2",
  "kimi-k1.5",
  "kimi-k1",
  "kimi-long",
  "k1.5",
  "k2",
  "k1",
]);

function modelText(model: Pick<ProviderModel, "id" | "name" | "upstreamModel">): string {
  return `${model.id} ${model.upstreamModel ?? ""} ${model.name}`.toLowerCase();
}

function hasKimi26(id: string, up: string, name: string): boolean {
  return (
    /\bk2\.6\b/.test(id) ||
    /\bk2\.6\b/.test(up) ||
    /k2\.6/i.test(name) ||
    id.includes("k2.6")
  );
}

export function isLegacyKimiModel(
  model: Pick<ProviderModel, "id" | "name" | "upstreamModel">
): boolean {
  const id = model.id.trim().toLowerCase();
  const up = (model.upstreamModel ?? "").trim().toLowerCase();
  const name = model.name.trim().toLowerCase();

  if (hasKimi26(id, up, name)) return false;

  if (KIMI_LEGACY_MODEL_IDS.has(id) || KIMI_LEGACY_MODEL_IDS.has(up)) {
    return true;
  }

  if (/kimi-long|长上下文|long[-_]?context/.test(id)) return true;
  if (/kimi-long|长上下文|long[-_]?context/.test(name)) return true;

  if (/^kimi-k1(?:\.\d+)?$/.test(id) || /^k1(?:\.\d+)?$/.test(up)) return true;

  if (id === "kimi-k2" || up === "k2") return true;

  if (/\bkimi\s+k2\b/.test(name) && !/k2\.6/.test(name)) return true;
  if (/\bkimi\s+k1/.test(name)) return true;

  return false;
}

/** OpenAI：2026-02 起已下线 gpt-4o / gpt-5.1 等，保留 gpt-5.2+ 与多模态 */
export function isLegacyChatGPTModel(
  model: Pick<ProviderModel, "id" | "name" | "upstreamModel">
): boolean {
  const t = modelText(model);

  if (/gpt-image|sora|codex|whisper|tts|realtime|dall-e|dalle/.test(t)) {
    return false;
  }

  if (/\bgpt-5\.(5|4|3|2)\b/.test(t)) return false;

  if (
    /^gpt-4|^gpt-3|gpt-4o|gpt-4\.|gpt-4-|o1-|o3-|o4-mini|o4_mini/.test(t)
  ) {
    return true;
  }

  if (/\bgpt-5\.1\b/.test(t)) return true;
  if (/\bgpt-5-(instant|thinking|pro)\b/.test(t) && !/\bgpt-5\.[2345]/.test(t)) {
    return true;
  }
  if (/\bgpt-5\b/.test(t) && !/\bgpt-5\.\d/.test(t)) return true;

  return false;
}

export function isLegacyClaudeModel(
  model: Pick<ProviderModel, "id" | "name" | "upstreamModel">
): boolean {
  const t = modelText(model);
  if (/claude-code/.test(t)) return false;
  if (/claude-(opus|sonnet|haiku)-4-([567])/.test(t)) return false;
  if (/claude-opus-4-7|claude-sonnet-4-6|claude-haiku-4-5/.test(t)) return false;
  if (/claude/.test(t)) return true;
  return false;
}

export function isLegacyGeminiModel(
  model: Pick<ProviderModel, "id" | "name" | "upstreamModel">
): boolean {
  const t = modelText(model);
  if (/imagen|veo/.test(t)) return false;
  if (/\bgemini-2\.5/.test(t)) return false;
  if (/\bgemini/.test(t)) return true;
  return false;
}

export function isLegacyGrokModel(
  model: Pick<ProviderModel, "id" | "name" | "upstreamModel">
): boolean {
  const t = modelText(model);
  if (/grok-imagine/.test(t)) return false;
  if (/\bgrok-4(\.|-)/.test(t) || /\bgrok-4\b/.test(t)) return false;
  if (/\bgrok/.test(t)) return true;
  return false;
}

export function isLegacyWebChatModel(
  providerSlug: string,
  model: Pick<ProviderModel, "id" | "name" | "upstreamModel">
): boolean {
  switch (providerSlug) {
    case "chatgpt":
      return isLegacyChatGPTModel(model);
    case "claude":
      return isLegacyClaudeModel(model);
    case "gemini":
      return isLegacyGeminiModel(model);
    case "grok":
      return isLegacyGrokModel(model);
    case "kimi":
      return isLegacyKimiModel(model);
    default:
      return false;
  }
}

export function dropLegacyWebChatModels(
  providerSlug: string,
  models: ProviderModel[]
): ProviderModel[] {
  return models.filter((m) => !isLegacyWebChatModel(providerSlug, m));
}
