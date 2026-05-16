import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { models, providers } from "@/lib/db/schema";
import { validateAdmin } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { isSyncableProvider } from "@/lib/models/catalog";

export const dynamic = "force-dynamic";

/** 快速返回服务商与已启用模型（不测速） */
export async function GET(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allProviders = await db
    .select({
      id: providers.id,
      slug: providers.slug,
      name: providers.name,
      baseUrl: providers.baseUrl,
      status: providers.status,
    })
    .from(providers);

  const activeModels = await db
    .select({
      providerId: models.providerId,
      modelId: models.modelId,
      name: models.name,
    })
    .from(models)
    .where(eq(models.status, "active"));

  const modelsByProvider = new Map<
    number,
    { modelId: string; name: string }[]
  >();
  for (const m of activeModels) {
    const list = modelsByProvider.get(m.providerId) ?? [];
    list.push({ modelId: m.modelId, name: m.name });
    modelsByProvider.set(m.providerId, list);
  }

  const rows = allProviders
    .filter(
      (p) =>
        isSyncableProvider(p.slug) ||
        (modelsByProvider.get(p.id)?.length ?? 0) > 0
    )
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      baseUrl: p.baseUrl ?? "",
      status: p.status,
      models: modelsByProvider.get(p.id) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  return NextResponse.json({ providers: rows });
}
