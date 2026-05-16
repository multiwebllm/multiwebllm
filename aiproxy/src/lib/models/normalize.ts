import type { ProviderModel } from "@/lib/providers/base";
import {
  findCatalogEntry,
  getCurrentYearCatalogForProvider,
  isCatalogModelId,
  isWebChatProvider,
  type CatalogModel,
} from "./catalog";
import { dropLegacyWebChatModels } from "./legacy-models";
import {
  capabilitiesForKind,
  inferModelKind,
  withKindCapabilities,
} from "./model-kind";
import { resolveModelLimits } from "./limits";
import { limitToLatestVersionTiers } from "./version-rank";

export function extractModelList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data
      .map((x) => normalizeListEntry(x))
      .filter((x): x is Record<string, unknown> => x !== null);
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;

    // DeepSeek 等：model_configs 为对象 map
    const configs = obj.model_configs;
    if (configs && typeof configs === "object" && !Array.isArray(configs)) {
      return Object.keys(configs as Record<string, unknown>).map((key) => ({
        slug: key,
        model: key,
        model_class: key,
      }));
    }

    // ChatGPT：categories[].models[]
    if (Array.isArray(obj.categories)) {
      const nested: Record<string, unknown>[] = [];
      for (const cat of obj.categories) {
        if (!cat || typeof cat !== "object") continue;
        const models = (cat as Record<string, unknown>).models;
        if (Array.isArray(models)) {
          for (const m of models) {
            const entry = normalizeListEntry(m);
            if (entry) nested.push(entry);
          }
        }
      }
      if (nested.length > 0) return nested;
    }

    for (const key of [
      "models",
      "data",
      "items",
      "list",
      "model_list",
      "available_models",
      "chat_models",
      "supported_models",
    ]) {
      const val = obj[key];
      if (Array.isArray(val)) {
        return val
          .map((x) => normalizeListEntry(x))
          .filter((x): x is Record<string, unknown> => x !== null);
      }
    }

    // 字符串数组：["gpt-4o", "o3", ...]
    const values = Object.values(obj);
    if (
      values.length > 0 &&
      values.every((v) => typeof v === "string" && v.length > 0)
    ) {
      return values.map((v) => ({ slug: v as string }));
    }
  }
  return [];
}

function normalizeListEntry(x: unknown): Record<string, unknown> | null {
  if (x && typeof x === "object") {
    return x as Record<string, unknown>;
  }
  if (typeof x === "string" && x.trim()) {
    return { slug: x.trim() };
  }
  return null;
}

export function extractOfficialId(item: Record<string, unknown>): string | null {
  for (const key of [
    "slug",
    "model",
    "model_id",
    "modelId",
    "model_name",
    "modelName",
    "model_slug",
    "modelSlug",
    "id",
    "name",
    "value",
  ]) {
    const v = item[key];
    if (typeof v === "string" && v.trim() && !v.includes(" ")) {
      return v.trim();
    }
  }
  return null;
}

export function extractDisplayName(
  item: Record<string, unknown>,
  officialId: string
): string {
  for (const key of ["title", "display_name", "displayName", "label", "name"]) {
    const v = item[key];
    if (typeof v === "string" && v.trim() && v !== officialId) {
      return v.trim();
    }
  }
  const catalog = findCatalogEntry("", officialId);
  return catalog?.name ?? officialId;
}

function catalogToProviderModel(entry: CatalogModel): ProviderModel {
  const kind = entry.modelKind ?? (entry.supportsImageGen ? "image" : "chat");
  const caps = capabilitiesForKind(kind);
  const limits = resolveModelLimits(kind, entry);
  return withKindCapabilities({
    id: entry.modelId,
    name: entry.name,
    upstreamModel: entry.upstreamModel,
    modelKind: kind,
    supportsVision: entry.supportsVision ?? caps.supportsVision,
    supportsImageGen: entry.supportsImageGen ?? caps.supportsImageGen,
    maxTokens: limits.maxTokens,
    contextWindow: limits.contextWindow,
    description: `${entry.name}（目录）`,
  });
}

/** 官网 API 无结果时使用本地目录（当年） */
export function catalogAsProviderModels(providerSlug: string): ProviderModel[] {
  return getCurrentYearCatalogForProvider(providerSlug).map(
    catalogToProviderModel
  );
}

/**
 * 官网列表 + 内置目录合并。
 * 内置网页服务商：保留完整当年目录 + 官网返回的非旧版模型（不再裁成仅 1 个聊天模型）。
 */
export function finalizeProviderModels(
  providerSlug: string,
  official: ProviderModel[]
): ProviderModel[] {
  const stripped = dropLegacyWebChatModels(providerSlug, official);

  if (!isWebChatProvider(providerSlug)) {
    return limitToLatestVersionTiers(dedupeProviderModels(stripped));
  }

  const catalog = catalogAsProviderModels(providerSlug);
  const seenId = new Set(catalog.map((m) => m.id.toLowerCase()));
  const seenUpstream = new Set(
    catalog.map((m) => (m.upstreamModel ?? m.id).toLowerCase())
  );

  const extras: ProviderModel[] = [];

  for (const m of stripped) {
    const id = m.id.toLowerCase();
    const up = (m.upstreamModel ?? m.id).toLowerCase();
    if (seenId.has(id) || seenUpstream.has(up)) continue;
    if (isCatalogModelId(providerSlug, m)) continue;
    extras.push(m);
    seenId.add(id);
    seenUpstream.add(up);
  }

  return dedupeProviderModels([...catalog, ...extras]);
}

export function isCatalogOnlyModels(models: ProviderModel[]): boolean {
  if (models.length === 0) return true;
  return models.every(
    (m) =>
      m.description?.includes("（目录）") ||
      m.description?.includes("（目录补充")
  );
}

/**
 * 将官网返回的一条记录规范为 ProviderModel。
 * id = 对外 modelId；upstreamModel = 官网实际 slug。
 */
export function normalizeOfficialModel(
  providerSlug: string,
  item: Record<string, unknown>
): ProviderModel | null {
  const officialId = extractOfficialId(item);
  if (!officialId) return null;

  const catalog = findCatalogEntry(providerSlug, officialId);
  const name =
    (typeof item.title === "string" && item.title) ||
    (typeof item.display_name === "string" && item.display_name) ||
    catalog?.name ||
    officialId;

  const tags = item.tags ?? item.capabilities;
  const tagStr = Array.isArray(tags)
    ? tags.join(" ").toLowerCase()
    : String(tags ?? "").toLowerCase();

  const modelKind = inferModelKind(officialId, tagStr, catalog?.modelKind);
  const caps = capabilitiesForKind(modelKind);

  const supportsVision =
    catalog?.supportsVision ??
    (modelKind === "chat" &&
      (tagStr.includes("vision") ||
        Boolean(item.supports_vision ?? item.supportsVision ?? item.vision)));

  const supportsImageGen =
    catalog?.supportsImageGen ??
    (modelKind === "image" ||
      tagStr.includes("dall") ||
      Boolean(item.supports_image_gen ?? item.supportsImageGen));

  const officialLimits = {
    maxTokens:
      (typeof item.max_output_tokens === "number" && item.max_output_tokens) ||
      (typeof item.max_tokens === "number" && item.max_tokens) ||
      (typeof item.maxTokens === "number" && item.maxTokens) ||
      undefined,
    contextWindow:
      (typeof item.context_window === "number" && item.context_window) ||
      (typeof item.contextWindow === "number" && item.contextWindow) ||
      (typeof item.context_length === "number" && item.context_length) ||
      undefined,
  };

  const limits = resolveModelLimits(modelKind, catalog, officialLimits);

  const modelId = catalog?.modelId ?? slugToModelId(officialId);

  return withKindCapabilities({
    id: modelId,
    name,
    upstreamModel: officialId,
    modelKind,
    description:
      (typeof item.description === "string" && item.description) ||
      undefined,
    supportsVision: supportsVision ?? caps.supportsVision,
    supportsImageGen: supportsImageGen ?? caps.supportsImageGen,
    maxTokens: limits.maxTokens,
    contextWindow: limits.contextWindow,
  });
}

function slugToModelId(officialId: string): string {
  return officialId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function dedupeProviderModels(models: ProviderModel[]): ProviderModel[] {
  const byId = new Map<string, ProviderModel>();
  for (const m of models) {
    const existing = byId.get(m.id);
    if (!existing) {
      byId.set(m.id, m);
      continue;
    }
    // 优先保留有 upstreamModel 且名称更长的条目
    if ((m.upstreamModel?.length ?? 0) >= (existing.upstreamModel?.length ?? 0)) {
      byId.set(m.id, { ...existing, ...m });
    }
  }
  return [...byId.values()];
}

export async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 15000
): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
