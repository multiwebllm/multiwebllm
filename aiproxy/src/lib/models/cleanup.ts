import { db } from "@/lib/db";
import { apiKeys, models, providers } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { isWebChatProvider } from "./catalog";
import { isLegacyWebChatModel } from "./legacy-models";

export interface UnrelatedModelsCleanupResult {
  deleted: number;
  deletedModelIds: string[];
  providerSlugs: string[];
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

/** 删除非网页聊天服务商（DeepSeek / Minimax / 豆包等）下的全部模型 */
export async function deleteUnrelatedModels(): Promise<UnrelatedModelsCleanupResult> {
  const allProviders = await db.select({
    id: providers.id,
    slug: providers.slug,
  }).from(providers);

  const unrelatedProviderIds = allProviders
    .filter((p) => !isWebChatProvider(p.slug))
    .map((p) => p.id);

  const unrelatedSlugs = allProviders
    .filter((p) => !isWebChatProvider(p.slug))
    .map((p) => p.slug);

  const legacyCleanup = await deleteLegacyWebChatModels();
  const inactiveCleanup = await deleteInactiveModels();

  if (unrelatedProviderIds.length === 0) {
    const allDeletedIds = [
      ...legacyCleanup.deletedModelIds,
      ...inactiveCleanup.deletedModelIds.filter(
        (id) => !legacyCleanup.deletedModelIds.includes(id)
      ),
    ];
    return {
      deleted: legacyCleanup.deleted + inactiveCleanup.deleted,
      deletedModelIds: allDeletedIds,
      providerSlugs: [],
      apiKeysUpdated: await scrubApiKeysAllowedModels(allDeletedIds),
      inactiveDeleted: inactiveCleanup.deleted,
    };
  }

  const rows = await db
    .select({ id: models.id, modelId: models.modelId })
    .from(models)
    .where(inArray(models.providerId, unrelatedProviderIds));

  const deletedModelIds = rows.map((r) => r.modelId);

  if (rows.length > 0) {
    await db
      .delete(models)
      .where(inArray(models.providerId, unrelatedProviderIds));
  }

  const allDeletedIds = [
    ...deletedModelIds,
    ...legacyCleanup.deletedModelIds,
    ...inactiveCleanup.deletedModelIds.filter(
      (id) =>
        !deletedModelIds.includes(id) &&
        !legacyCleanup.deletedModelIds.includes(id)
    ),
  ];
  const apiKeysUpdated = await scrubApiKeysAllowedModels(allDeletedIds);

  return {
    deleted: rows.length + legacyCleanup.deleted + inactiveCleanup.deleted,
    deletedModelIds: allDeletedIds,
    providerSlugs: unrelatedSlugs,
    apiKeysUpdated,
    inactiveDeleted: inactiveCleanup.deleted,
  };
}
