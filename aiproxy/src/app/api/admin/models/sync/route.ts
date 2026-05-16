import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { models, providers } from "@/lib/db/schema";
import { validateAdmin } from "@/lib/auth";
import { eq, and, notInArray } from "drizzle-orm";
import { getProvider } from "@/lib/providers";
import type { ProviderModel } from "@/lib/providers/base";
import { isCatalogOnlyModels } from "@/lib/models/normalize";
import { isWebChatProvider } from "@/lib/models/catalog";
import { deleteUnrelatedModels } from "@/lib/models/cleanup";

export const dynamic = "force-dynamic";

interface SyncResult {
  providerId: number;
  providerName: string;
  providerSlug: string;
  success: boolean;
  added: number;
  updated: number;
  removed: number;
  skipped: number;
  skippedReason?: string;
  usedCatalog: boolean;
  modelCount: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cleanup = await deleteUnrelatedModels();

  let body: { providerId?: number } = {};
  try {
    body = await request.json();
  } catch {
    // No body provided, sync all providers
  }

  let providersToSync: {
    id: number;
    name: string;
    slug: string;
    authData: unknown;
    baseUrl: string | null;
  }[] = [];

  if (body.providerId) {
    const provider = await db
      .select()
      .from(providers)
      .where(eq(providers.id, body.providerId))
      .limit(1);
    if (provider.length > 0) {
      providersToSync = provider;
    }
  } else {
    const active = await db
      .select()
      .from(providers)
      .where(eq(providers.status, "active"));
    providersToSync = active.filter((p) => isWebChatProvider(p.slug));
  }

  if (providersToSync.length === 0) {
    return NextResponse.json(
      { error: "No providers found to sync" },
      { status: 404 }
    );
  }

  const results: SyncResult[] = [];

  for (const provider of providersToSync) {
    const result: SyncResult = {
      providerId: provider.id,
      providerName: provider.name,
      providerSlug: provider.slug,
      success: false,
      added: 0,
      updated: 0,
      removed: 0,
      skipped: 0,
      usedCatalog: false,
      modelCount: 0,
    };

    if (!isWebChatProvider(provider.slug)) {
      result.skipped = 1;
      result.skippedReason =
        "该服务商为开放平台 API，不支持网页聊天模型同步（仅支持 ChatGPT / Claude / Gemini / Grok / Kimi）";
      result.success = true;
      results.push(result);
      continue;
    }

    try {
      const providerInstance = getProvider(provider.slug, {
        authData: (provider.authData as Record<string, unknown>) ?? {},
        baseUrl: provider.baseUrl ?? undefined,
      });

      const fetchedModels = await providerInstance.fetchModels();
      result.modelCount = fetchedModels.length;
      // fetchModels 内已按「最新 2 个主版本档」裁剪
      result.usedCatalog = isCatalogOnlyModels(fetchedModels);

      if (!fetchedModels || fetchedModels.length === 0) {
        result.success = true;
        results.push(result);
        continue;
      }

      const existingModels = await db
        .select({
          id: models.id,
          modelId: models.modelId,
        })
        .from(models)
        .where(eq(models.providerId, provider.id));

      const existingModelIds = new Map(
        existingModels.map((m) => [m.modelId, m.id])
      );
      const syncedModelIds: string[] = [];

      for (const model of fetchedModels) {
        syncedModelIds.push(model.id);
        const upstream = model.upstreamModel ?? model.id;
        const existingId = existingModelIds.get(model.id);

        if (existingId) {
          await db
            .update(models)
            .set({
              name: model.name,
              upstreamModel: upstream,
              supportsVision: model.supportsVision ?? false,
              supportsImageGen: model.supportsImageGen ?? false,
              maxTokens: model.maxTokens ?? 4096,
              status: "active",
            })
            .where(eq(models.id, existingId));
          result.updated++;
        } else {
          await db.insert(models).values({
            providerId: provider.id,
            name: model.name,
            modelId: model.id,
            upstreamModel: upstream,
            supportsVision: model.supportsVision ?? false,
            supportsImageGen: model.supportsImageGen ?? false,
            maxTokens: model.maxTokens ?? 4096,
            status: "active",
          });
          result.added++;
        }
      }

      // 删除本次同步未出现的旧版模型（仅当成功拉取到列表时）
      if (syncedModelIds.length > 0) {
        const stale = await db
          .delete(models)
          .where(
            and(
              eq(models.providerId, provider.id),
              notInArray(models.modelId, syncedModelIds)
            )
          )
          .returning({ modelId: models.modelId });
        result.removed = stale.length;
      }

      result.success = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Unknown error";
    }

    results.push(result);
  }

  const totalAdded = results.reduce((sum, r) => sum + r.added, 0);
  const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
  const totalRemoved = results.reduce((sum, r) => sum + r.removed, 0);
  const catalogFallbacks = results.filter((r) => r.usedCatalog).length;
  const hasErrors = results.some((r) => !r.success);

  return NextResponse.json({
    success: !hasErrors,
    summary: {
      totalAdded,
      totalUpdated,
      totalRemoved,
      catalogFallbacks,
      providersSynced: results.length,
      unrelatedDeleted: cleanup.deleted,
    },
    cleanup,
    results,
  });
}
