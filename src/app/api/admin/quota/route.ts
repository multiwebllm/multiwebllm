import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { quotaSnapshots, providers } from "@/lib/db/schema";
import { validateAdmin } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get latest quota snapshot for each provider using a subquery
  const latestSnapshots = await db
    .select({
      id: quotaSnapshots.id,
      providerId: quotaSnapshots.providerId,
      providerName: providers.name,
      totalQuota: quotaSnapshots.totalQuota,
      usedQuota: quotaSnapshots.usedQuota,
      remaining: quotaSnapshots.remaining,
      snapshotType: quotaSnapshots.snapshotType,
      rawData: quotaSnapshots.rawData,
      createdAt: quotaSnapshots.createdAt,
    })
    .from(quotaSnapshots)
    .leftJoin(providers, eq(quotaSnapshots.providerId, providers.id))
    .where(
      sql`${quotaSnapshots.id} IN (
        SELECT DISTINCT ON (provider_id) id
        FROM quota_snapshots
        ORDER BY provider_id, created_at DESC
      )`
    );

  return NextResponse.json(latestSnapshots);
}

export async function POST(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { providerId: number };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.providerId) {
    return NextResponse.json(
      { error: "Missing required field: providerId" },
      { status: 400 }
    );
  }

  // Get provider
  const providerResults = await db
    .select()
    .from(providers)
    .where(eq(providers.id, body.providerId))
    .limit(1);

  if (providerResults.length === 0) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  const providerRecord = providerResults[0];

  try {
    const { getProvider } = await import("@/lib/providers");
    const provider = getProvider(providerRecord.slug, {
      authData: (providerRecord.authData as Record<string, unknown>) ?? {},
      baseUrl: providerRecord.baseUrl,
    });

    const quotaInfo = await provider.checkQuota();

    // Save snapshot
    const result = await db
      .insert(quotaSnapshots)
      .values({
        providerId: providerRecord.id,
        totalQuota: quotaInfo.total ?? null,
        usedQuota: quotaInfo.used ?? null,
        remaining: quotaInfo.remaining ?? null,
        snapshotType: "api_check",
        rawData: quotaInfo.raw ?? null,
      })
      .returning();

    // Update provider last checked timestamp
    await db
      .update(providers)
      .set({ lastCheckedAt: new Date() })
      .where(eq(providers.id, providerRecord.id));

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to check quota: ${message}` },
      { status: 500 }
    );
  }
}
