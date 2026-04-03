import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usageLogs, apiKeys, providers, models } from "@/lib/db/schema";
import { validateAdmin } from "@/lib/auth";
import { eq, sql, desc, gte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // Summary stats
  if (searchParams.get("summary") === "true") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayStats] = await db
      .select({
        count: sql<number>`count(*)::int`,
        totalTokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)::int`,
      })
      .from(usageLogs)
      .where(gte(usageLogs.createdAt, today));

    const [activeKeysResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apiKeys)
      .where(eq(apiKeys.status, "active"));

    const [activeProvidersResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(providers)
      .where(eq(providers.status, "active"));

    return NextResponse.json({
      todayRequests: todayStats.count,
      totalTokens: todayStats.totalTokens,
      activeKeys: activeKeysResult.count,
      activeProviders: activeProvidersResult.count,
    });
  }

  // Chart: requests over last 7 days
  if (searchParams.get("chart") === "requests") {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const data = await db
      .select({
        date: sql<string>`to_char(${usageLogs.createdAt}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(usageLogs)
      .where(gte(usageLogs.createdAt, sevenDaysAgo))
      .groupBy(sql`to_char(${usageLogs.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${usageLogs.createdAt}, 'YYYY-MM-DD')`);

    return NextResponse.json(data);
  }

  // Chart: provider distribution (pie chart)
  if (searchParams.get("chart") === "providers") {
    const data = await db
      .select({
        name: providers.name,
        value: sql<number>`count(*)::int`,
      })
      .from(usageLogs)
      .leftJoin(providers, eq(usageLogs.providerId, providers.id))
      .groupBy(providers.name);

    return NextResponse.json(data);
  }

  // Recent logs
  const recentParam = searchParams.get("recent");
  if (recentParam) {
    const limit = parseInt(recentParam, 10) || 20;

    const data = await db
      .select({
        id: usageLogs.id,
        apiKeyId: usageLogs.apiKeyId,
        modelId: usageLogs.modelId,
        providerId: usageLogs.providerId,
        providerName: providers.name,
        modelName: models.name,
        promptTokens: usageLogs.promptTokens,
        completionTokens: usageLogs.completionTokens,
        totalTokens: usageLogs.totalTokens,
        latencyMs: usageLogs.latencyMs,
        status: usageLogs.status,
        errorMessage: usageLogs.errorMessage,
        createdAt: usageLogs.createdAt,
      })
      .from(usageLogs)
      .leftJoin(providers, eq(usageLogs.providerId, providers.id))
      .leftJoin(models, eq(usageLogs.modelId, models.modelId))
      .orderBy(desc(usageLogs.createdAt))
      .limit(limit);

    return NextResponse.json(data);
  }

  // Grouped usage stats: ?range=7d|30d&groupBy=model
  const range = searchParams.get("range");
  const groupBy = searchParams.get("groupBy");

  if (range) {
    const days = range === "30d" ? 30 : 7;
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    if (groupBy === "model") {
      const data = await db
        .select({
          modelId: usageLogs.modelId,
          modelName: models.name,
          requests: sql<number>`count(*)::int`,
          totalTokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)::int`,
          promptTokens: sql<number>`coalesce(sum(${usageLogs.promptTokens}), 0)::int`,
          completionTokens: sql<number>`coalesce(sum(${usageLogs.completionTokens}), 0)::int`,
          avgLatency: sql<number>`coalesce(avg(${usageLogs.latencyMs}), 0)::int`,
          errors: sql<number>`count(*) filter (where ${usageLogs.status} = 'error')::int`,
        })
        .from(usageLogs)
        .leftJoin(models, eq(usageLogs.modelId, models.modelId))
        .where(gte(usageLogs.createdAt, since))
        .groupBy(usageLogs.modelId, models.name);

      return NextResponse.json(data);
    }

    // Default: grouped by date
    const data = await db
      .select({
        date: sql<string>`to_char(${usageLogs.createdAt}, 'YYYY-MM-DD')`,
        requests: sql<number>`count(*)::int`,
        totalTokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)::int`,
        avgLatency: sql<number>`coalesce(avg(${usageLogs.latencyMs}), 0)::int`,
      })
      .from(usageLogs)
      .where(gte(usageLogs.createdAt, since))
      .groupBy(sql`to_char(${usageLogs.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${usageLogs.createdAt}, 'YYYY-MM-DD')`);

    return NextResponse.json(data);
  }

  // Default: return recent 20 logs
  const data = await db
    .select()
    .from(usageLogs)
    .orderBy(desc(usageLogs.createdAt))
    .limit(20);

  return NextResponse.json(data);
}
