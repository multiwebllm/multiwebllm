import { db } from "@/lib/db";
import { apiKeys, models, providers } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { REMOVED_PROVIDER_SLUGS } from "./catalog";
import { isLegacyWebChatModel } from "./legacy-models";

export interface UnrelatedModelsCleanupResult {
  deleted: number;
  deletedModelIds: string[];
  providerSlugs: string[];
  removedProviders: number;
  apiKeysUpdated: number;
  inactiveDeleted: number;
}

async function scrubApiKeysAllowedModels(deletedModelIds: string[]): Promise<number> {
  if (deletedModelIds.length === 0) return 0;
  const deletedSet = new Set(deletedModelIds);
  let apiKeysUpdated = 0;
  const keys = await db.select().from(apiKeys);
  for (const key of keys) {
    const allowed = key.allowedModels ?? [];
    const filtered = allowed.filter((id) => !deletedSet.has(id));
    if (filtered.length !== allowed.length) {
      await db
        .update(apiKeys)
        .set({ allowedModels: filtered })
        .where(eq(apiKeys.id, key.id));
      apiKeysUpdated++;
    }
  }
  return apiKeysUpdated;
}

/** 删除 Kimi K2 / K1.5 / 长上下文等已知旧版（含 inactive） */
export async function deleteLegacyWebChatModels(): Promise<{
  deleted: number;
  deletedModelIds: string[];
}> {
  const rows = await db
    .select({
      id: models.id,
      modelId: models.modelId,
      name: models.name,
      upstreamModel: models.upstreamModel,
      slug: providers.slug,
    })
    .from(models)
    .innerJoin(providers, eq(models.providerId, providers.id))
    .where(eq(providers.slug, "kimi"));

  const legacy = rows.filter((r) =>
    isLegacyWebChatModel(r.slug, {
      id: r.modelId,
      name: r.name,
      upstreamModel: r.upstreamModel ?? undefined,
    })
  );

  if (legacy.length === 0) {
    return { deleted: 0, deletedModelIds: [] };
  }

  const deletedModelIds = legacy.map((r) => r.modelId);
  await db.delete(models).where(
    inArray(
      models.id,
      legacy.map((r) => r.id)
    )
  );
  await scrubApiKeysAllowedModels(deletedModelIds);

  return { deleted: legacy.length, deletedModelIds };
}

/** 删除已停用的旧模型（如 Claude 3.5 Haiku），列表只保留启用中的最新档 */
export async function deleteInactiveModels(): Promise<{
  deleted: number;
  deletedModelIds: string[];
}> {
  const rows = await db
    .select({ modelId: models.modelId })
    .from(models)
    .where(eq(models.status, "inactive"));

  const deletedModelIds = rows.map((r) => r.modelId);
  if (rows.length === 0) {
    return { deleted: 0, deletedModelIds: [] };
  }

  await db.delete(models).where(eq(models.status, "inactive"));
  await scrubApiKeysAllowedModels(deletedModelIds);

  return { deleted: rows.length, deletedModelIds };
}

/** 删除已下线的内置服务商（DeepSeek / Minimax / 豆包）及其模型 */
export async function deleteRemovedProviders(): Promise<{
  removedProviders: number;
  deletedModelIds: string[];
}> {
  const removed = await db
    .select({ id: providers.id })
    .from(providers)
    .where(inArray(providers.slug, [...REMOVED_PROVIDER_SLUGS] as string[]));

  if (removed.length === 0) {
    return { removedProviders: 0, deletedModelIds: [] };
  }

  const ids = removed.map((p) => p.id);
  const modelRows = await db
    .select({ modelId: models.modelId })
    .from(models)
    .where(inArray(models.providerId, ids));

  const deletedModelIds = modelRows.map((r) => r.modelId);
  await db.delete(providers).where(inArray(providers.id, ids));
  await scrubApiKeysAllowedModels(deletedModelIds);

  return { removedProviders: removed.length, deletedModelIds };
}

/** 清理旧版 Kimi、inactive 模型，并移除已下线服务商 */
export async function deleteUnrelatedModels(): Promise<UnrelatedModelsCleanupResult> {
  const removedCleanup = await deleteRemovedProviders();
  const legacyCleanup = await deleteLegacyWebChatModels();
  const inactiveCleanup = await deleteInactiveModels();

  const allDeletedIds = [
    ...removedCleanup.deletedModelIds,
    ...legacyCleanup.deletedModelIds,
    ...inactiveCleanup.deletedModelIds.filter(
      (id) =>
        !removedCleanup.deletedModelIds.includes(id) &&
        !legacyCleanup.deletedModelIds.includes(id)
    ),
  ];

  const apiKeysUpdated = await scrubApiKeysAllowedModels(allDeletedIds);

  return {
    deleted:
      removedCleanup.deletedModelIds.length +
      legacyCleanup.deleted +
      inactiveCleanup.deleted,
    deletedModelIds: allDeletedIds,
    providerSlugs: [...REMOVED_PROVIDER_SLUGS],
    removedProviders: removedCleanup.removedProviders,
    apiKeysUpdated,
    inactiveDeleted: inactiveCleanup.deleted,
  };
}
