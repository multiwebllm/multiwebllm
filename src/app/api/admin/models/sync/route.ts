import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { models, providers } from "@/lib/db/schema";
import { validateAdmin } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { getProvider } from "@/lib/providers";

interface SyncResult {
  providerId: number;
  providerName: string;
  providerSlug: string;
  success: boolean;
  added: number;
  updated: number;
  skipped: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { providerId?: number } = {};
  try {
    body = await request.json();
  } catch {
    // No body provided, sync all providers
  }

  // Get providers to sync
  let providersToSync: { id: number; name: string; slug: string; authData: unknown; baseUrl: string | null }[] = [];
  
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
    // Sync all active providers
    providersToSync = await db
      .select()
      .from(providers)
      .where(eq(providers.status, "active"));
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
      skipped: 0,
    };

    try {
      // Get provider instance
      const providerInstance = getProvider(provider.slug, {
        authData: (provider.authData as Record<string, unknown>) ?? {},
        baseUrl: provider.baseUrl ?? undefined,
      });

      // Fetch models from provider
      const fetchedModels = await providerInstance.fetchModels();

      if (!fetchedModels || fetchedModels.length === 0) {
        result.skipped = 0;
        result.success = true;
        results.push(result);
        continue;
      }

      // Get existing models for this provider
      const existingModels = await db
        .select({
          id: models.id,
          modelId: models.modelId,
        })
        .from(models)
        .where(eq(models.providerId, provider.id));

      const existingModelIds = new Map(existingModels.map(m => [m.modelId, m.id]));

      for (const model of fetchedModels) {
        const existingId = existingModelIds.get(model.id);

        if (existingId) {
          // Update existing model
          await db
            .update(models)
            .set({
              name: model.name,
              upstreamModel: model.id, // Use model id as upstream model
              supportsVision: model.supportsVision ?? false,
              supportsImageGen: model.supportsImageGen ?? false,
              maxTokens: model.maxTokens ?? 4096,
            })
            .where(eq(models.id, existingId));
          result.updated++;
        } else {
          // Insert new model
          await db.insert(models).values({
            providerId: provider.id,
            name: model.name,
            modelId: model.id,
            upstreamModel: model.id,
            supportsVision: model.supportsVision ?? false,
            supportsImageGen: model.supportsImageGen ?? false,
            maxTokens: model.maxTokens ?? 4096,
            status: "active",
          });
          result.added++;
        }
      }

      result.success = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Unknown error";
    }

    results.push(result);
  }

  const totalAdded = results.reduce((sum, r) => sum + r.added, 0);
  const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
  const hasErrors = results.some(r => !r.success);

  return NextResponse.json({
    success: !hasErrors,
    summary: {
      totalAdded,
      totalUpdated,
      totalSkipped,
      providersSynced: results.length,
    },
    results,
  });
}
