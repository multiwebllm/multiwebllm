import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usageLogs, apiKeys, providers, models } from "@/lib/db/schema";
import { validateAdmin } from "@/lib/auth";
import { eq, sql, gte, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "24h";
  const granularity = searchParams.get("granularity") || "hour";

  // 计算时间范围
  const now = new Date();
  const since = new Date();
  switch (range) {
    case "1h":
      since.setHours(since.getHours() - 1);
      break;
    case "6h":
      since.setHours(since.getHours() - 6);
      break;
    case "24h":
      since.setHours(since.getHours() - 24);
      break;
    case "7d":
      since.setDate(since.getDate() - 7);
      break;
    case "30d":
      since.setDate(since.getDate() - 30);
      break;
    default:
      since.setHours(since.getHours() - 24);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 并行查询
  const [
    statsResult,
    totalStatsResult,
    keysResult,
    providersResult,
    activeKeysResult,
    tokenTrendResult,
    modelDistResult,
    recentLogsResult,
    topUsersResult,
  ] = await Promise.all([
    // 今日统计
    db
      .select({
        requests: sql<number>`count(*)::int`,
        totalTokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)::bigint`,
        avgLatency: sql<number>`coalesce(avg(${usageLogs.latencyMs}), 0)::int`,
        errors: sql<number>`count(*) filter (where ${usageLogs.status} = 'error')::int`,
      })
      .from(usageLogs)
      .where(gte(usageLogs.createdAt, today)),

    // 总统计
    db
      .select({
        totalTokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)::bigint`,
        totalRequests: sql<number>`count(*)::int`,
      })
      .from(usageLogs),

    // API Key 统计
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${apiKeys.status} = 'active')::int`,
      })
      .from(apiKeys),

    // Provider(账号) 统计
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${providers.status} = 'active')::int`,
      })
      .from(providers),

    // 最近1分钟活跃的唯一 key 数
    db
      .select({
        count: sql<number>`count(distinct ${usageLogs.apiKeyId})::int`,
      })
      .from(usageLogs)
      .where(gte(usageLogs.createdAt, new Date(now.getTime() - 60000))),

    // Token 使用趋势 (按时间粒度)
    (() => {
      const fmt =
        granularity === "hour"
          ? "YYYY-MM-DD HH24:00"
          : granularity === "minute"
          ? "YYYY-MM-DD HH24:MI"
          : "YYYY-MM-DD";
      const timeExpr = sql`to_char(${usageLogs.createdAt}, ${sql.raw(`'${fmt}'`)})`;
      return db
        .select({
          time: sql<string>`${timeExpr}`,
          tokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)::int`,
          requests: sql<number>`count(*)::int`,
        })
        .from(usageLogs)
        .where(gte(usageLogs.createdAt, since))
        .groupBy(timeExpr)
        .orderBy(timeExpr);
    })(),

    // 模型分布
    db
      .select({
        modelId: usageLogs.modelId,
        modelName: models.name,
        requests: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)::int`,
      })
      .from(usageLogs)
      .leftJoin(models, eq(usageLogs.modelId, models.modelId))
      .where(gte(usageLogs.createdAt, since))
      .groupBy(usageLogs.modelId, models.name)
      .orderBy(desc(sql`count(*)`))
      .limit(10),

    // 最近使用 Top 12
    db
      .select({
        id: usageLogs.id,
        modelId: usageLogs.modelId,
        modelName: models.name,
        providerName: providers.name,
        totalTokens: usageLogs.totalTokens,
        latencyMs: usageLogs.latencyMs,
        status: usageLogs.status,
        createdAt: usageLogs.createdAt,
      })
      .from(usageLogs)
      .leftJoin(models, eq(usageLogs.modelId, models.modelId))
      .leftJoin(providers, eq(usageLogs.providerId, providers.id))
      .orderBy(desc(usageLogs.createdAt))
      .limit(12),

    // Top API Key 用量
    db
      .select({
        keyId: usageLogs.apiKeyId,
        keyName: apiKeys.name,
        requests: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)::int`,
      })
      .from(usageLogs)
      .leftJoin(apiKeys, eq(usageLogs.apiKeyId, apiKeys.id))
      .where(gte(usageLogs.createdAt, since))
      .groupBy(usageLogs.apiKeyId, apiKeys.name)
      .orderBy(desc(sql`sum(${usageLogs.totalTokens})`))
      .limit(10),
  ]);

  const todayStats = statsResult[0];
  const totalStats = totalStatsResult[0];
  const keys = keysResult[0];
  const providerStats = providersResult[0];
  const activeKeyCount = activeKeysResult[0];

  // 计算 RPM/TPM (最近1分钟)
  const [minuteStats] = await db
    .select({
      requests: sql<number>`count(*)::int`,
      tokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)::int`,
    })
    .from(usageLogs)
    .where(gte(usageLogs.createdAt, new Date(now.getTime() - 60000)));

  // 计算今日费用估算 (简单估算: $0.01 per 1000 tokens)
  const todayTokenCost = (Number(todayStats.totalTokens) / 1000) * 0.01;
  const totalTokenCost = (Number(totalStats.totalTokens) / 1000) * 0.01;

  return NextResponse.json({
    // 概览卡片
    cards: {
      apiKeys: { total: keys.total, active: keys.active },
      accounts: { total: providerStats.total, active: providerStats.active },
      todayRequests: { count: todayStats.requests, total: totalStats.totalRequests },
      users: { active: activeKeyCount.count, total: keys.total },
      todayTokens: {
        count: Number(todayStats.totalTokens),
        cost: todayTokenCost.toFixed(4),
        totalCost: totalTokenCost.toFixed(4),
      },
      totalTokens: {
        count: Number(totalStats.totalTokens),
        cost: totalTokenCost.toFixed(4),
      },
      performance: {
        rpm: minuteStats.requests,
        tpm: minuteStats.tokens,
      },
      avgLatency: {
        ms: todayStats.avgLatency,
        activeUsers: activeKeyCount.count,
      },
    },
    // 图表数据
    tokenTrend: tokenTrendResult,
    modelDistribution: modelDistResult,
    topUsers: topUsersResult,
    recentLogs: recentLogsResult,
  });
}
