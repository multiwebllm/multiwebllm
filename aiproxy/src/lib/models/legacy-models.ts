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

function hasKimi26(id: string, up: string, name: string): boolean {
  return (
    /\bk2\.6\b/.test(id) ||
    /\bk2\.6\b/.test(up) ||
    /k2\.6/i.test(name) ||
    id.includes("k2.6")
  );
}

/** Kimi K2 / K1.5 / 长上下文等旧档，不同步、不展示 */
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

export function isLegacyWebChatModel(
  providerSlug: string,
  model: Pick<ProviderModel, "id" | "name" | "upstreamModel">
): boolean {
  if (providerSlug === "kimi") {
    return isLegacyKimiModel(model);
  }
  return false;
}

export function dropLegacyWebChatModels(
  providerSlug: string,
  models: ProviderModel[]
): ProviderModel[] {
  return models.filter((m) => !isLegacyWebChatModel(providerSlug, m));
}
