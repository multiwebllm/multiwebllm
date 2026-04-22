import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usageLogs, providers, models } from "@/lib/db/schema";
import { validateAdmin } from "@/lib/auth";
import { eq, sql, gte, desc, and } from "drizzle-orm";
import { createClient } from "redis";

// 获取活跃连接数（从Redis统计）
async function getActiveConnections(): Promise<number> {
  try {
    const client = createClient({ url: process.env.REDIS_URL });
    await client.connect();
    // 统计最近1分钟有活动的唯一连接标识
    const keys = await client.keys("conn:*");
    await client.disconnect();
    return keys.length;
  } catch {
    return 0;
  }
}

export async function GET(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "1h";

  const now = new Date();
  const since = new Date();
  switch (range) {
    case "1min":
      since.setSeconds(since.getSeconds() - 60);
      break;
    case "5min":
      since.setMinutes(since.getMinutes() - 5);
      break;
    case "30min":
      since.setMinutes(since.getMinutes() - 30);
      break;
    case "1h":
      since.setHours(since.getHours() - 1);
      break;
    case "6h":
      since.setHours(since.getHours() - 6);
      break;
    case "24h":
      since.setHours(since.getHours() - 24);
      break;
    default:
      since.setHours(since.getHours() - 1);
  }

  const elapsedSeconds = (now.getTime() - since.getTime()) / 1000;

  const [
    requestStats,
    latencyStats,
    errorStats,
    providerDistribution,
    modelUsage,
    requestTrend,
    tokenTrend,
    latencyTrend,
    errorTrend,
    latencyDistribution,
    recentErrors,
    providerHealth,
    activeConnections,
  ] = await Promise.all([
    // 请求/Token 汇总
    db
      .select({
        requests: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)::bigint`,
        errors: sql<number>`count(*) filter (where ${usageLogs.status} = 'error')::int`,
        successRate: sql<number>`
          case when count(*) = 0 then 100
          else round((count(*) filter (where ${usageLogs.status} = 'success')::numeric / count(*)::numeric) * 100, 3)
          end
        `,
        avgResponseTime: sql<number>`coalesce(avg(${usageLogs.latencyMs}), 0)::int`,
      })
      .from(usageLogs)
      .where(gte(usageLogs.createdAt, since)),

    // 延迟统计
    db
      .select({
        p50: sql<number>`coalesce(percentile_cont(0.5) within group (order by ${usageLogs.latencyMs}), 0)::int`,
        p90: sql<number>`coalesce(percentile_cont(0.9) within group (order by ${usageLogs.latencyMs}), 0)::int`,
        p95: sql<number>`coalesce(percentile_cont(0.95) within group (order by ${usageLogs.latencyMs}), 0)::int`,
        p99: sql<number>`coalesce(percentile_cont(0.99) within group (order by ${usageLogs.latencyMs}), 0)::int`,
        avg: sql<number>`coalesce(avg(${usageLogs.latencyMs}), 0)::int`,
        max: sql<number>`coalesce(max(${usageLogs.latencyMs}), 0)::int`,
      })
      .from(usageLogs)
      .where(gte(usageLogs.createdAt, since)),

    // 错误分布 (按类型)
    db
      .select({
        errorMessage: usageLogs.errorMessage,
        count: sql<number>`count(*)::int`,
      })
      .from(usageLogs)
      .where(
        and(
          gte(usageLogs.createdAt, since),
          eq(usageLogs.status, 'error')
        )
      )
      .groupBy(usageLogs.errorMessage)
      .orderBy(desc(sql`count(*)`))
      .limit(10),

    // Provider 分布
    db
      .select({
        providerName: providers.name,
        providerSlug: providers.slug,
        requests: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)::int`,
        errors: sql<number>`count(*) filter (where ${usageLogs.status} = 'error')::int`,
        avgLatency: sql<number>`coalesce(avg(${usageLogs.latencyMs}), 0)::int`,
        cost: sql<number>`coalesce(sum(${usageLogs.totalTokens} * 0.000002), 0)::numeric`,
      })
      .from(usageLogs)
      .leftJoin(providers, eq(usageLogs.providerId, providers.id))
      .where(gte(usageLogs.createdAt, since))
      .groupBy(providers.name, providers.slug)
      .orderBy(desc(sql`count(*)`)),

    // 模型使用排行
    db
      .select({
        modelId: usageLogs.modelId,
        modelName: models.name,
        providerName: providers.name,
        requests: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)::int`,
      })
      .from(usageLogs)
      .leftJoin(models, eq(usageLogs.modelId, models.modelId))
      .leftJoin(providers, eq(usageLogs.providerId, providers.id))
      .where(gte(usageLogs.createdAt, since))
      .groupBy(usageLogs.modelId, models.name, providers.name)
      .orderBy(desc(sql`count(*)`))
      .limit(10),

    // 请求趋势 (包含错误)
    (() => {
      const fmt =
        range === "1min" || range === "5min"
          ? "HH24:MI:SS"
          : range === "30min" || range === "1h"
          ? "HH24:MI"
          : range === "6h"
          ? "HH24:MI"
          : "YYYY-MM-DD HH24:00";
      const timeExpr = sql`to_char(${usageLogs.createdAt}, ${sql.raw(`'${fmt}'`)})`;
      return db
        .select({
          time: sql<string>`${timeExpr}`,
          requests: sql<number>`count(*)::int`,
          tokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)::int`,
          errors: sql<number>`count(*) filter (where ${usageLogs.status} = 'error')::int`,
        })
        .from(usageLogs)
        .where(gte(usageLogs.createdAt, since))
        .groupBy(timeExpr)
        .orderBy(timeExpr);
    })(),

    // Token 消耗趋势 (input/output分开)
    (() => {
      const fmt =
        range === "1min" || range === "5min"
          ? "HH24:MI:SS"
          : range === "30min" || range === "1h"
          ? "HH24:MI"
          : range === "6h"
          ? "HH24:MI"
          : "YYYY-MM-DD HH24:00";
      const timeExpr = sql`to_char(${usageLogs.createdAt}, ${sql.raw(`'${fmt}'`)})`;
      return db
        .select({
          time: sql<string>`${timeExpr}`,
          inputTokens: sql<number>`coalesce(sum(${usageLogs.promptTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${usageLogs.completionTokens}), 0)::int`,
          cost: sql<number>`coalesce(sum((${usageLogs.promptTokens} * 0.0000015 + ${usageLogs.completionTokens} * 0.000002)), 0)::numeric`,
        })
        .from(usageLogs)
        .where(gte(usageLogs.createdAt, since))
        .groupBy(timeExpr)
        .orderBy(timeExpr);
    })(),

    // 延迟趋势
    (() => {
      const fmt =
        range === "1min" || range === "5min"
          ? "HH24:MI:SS"
          : range === "30min" || range === "1h"
          ? "HH24:MI"
          : range === "6h"
          ? "HH24:MI"
          : "YYYY-MM-DD HH24:00";
      const timeExpr = sql`to_char(${usageLogs.createdAt}, ${sql.raw(`'${fmt}'`)})`;
      return db
        .select({
          time: sql<string>`${timeExpr}`,
          p50: sql<number>`coalesce(percentile_cont(0.5) within group (order by ${usageLogs.latencyMs}), 0)::int`,
          p99: sql<number>`coalesce(percentile_cont(0.99) within group (order by ${usageLogs.latencyMs}), 0)::int`,
          avg: sql<number>`coalesce(avg(${usageLogs.latencyMs}), 0)::int`,
        })
        .from(usageLogs)
        .where(gte(usageLogs.createdAt, since))
        .groupBy(timeExpr)
        .orderBy(timeExpr);
    })(),

    // 错误趋势
    (() => {
      const fmt =
        range === "1min" || range === "5min"
          ? "HH24:MI:SS"
          : range === "30min" || range === "1h"
          ? "HH24:MI"
          : range === "6h"
          ? "HH24:MI"
          : "YYYY-MM-DD HH24:00";
      const timeExpr = sql`to_char(${usageLogs.createdAt}, ${sql.raw(`'${fmt}'`)})`;
      return db
        .select({
          time: sql<string>`${timeExpr}`,
          errors: sql<number>`count(*) filter (where ${usageLogs.status} = 'error')::int`,
          total: sql<number>`count(*)::int`,
        })
        .from(usageLogs)
        .where(gte(usageLogs.createdAt, since))
        .groupBy(timeExpr)
        .orderBy(timeExpr);
    })(),

    // 延迟分布直方图
    db
      .select({
        range: sql<string>`case 
          when ${usageLogs.latencyMs} < 100 then '0-100ms'
          when ${usageLogs.latencyMs} < 300 then '100-300ms'
          when ${usageLogs.latencyMs} < 500 then '300-500ms'
          when ${usageLogs.latencyMs} < 1000 then '500ms-1s'
          when ${usageLogs.latencyMs} < 3000 then '1-3s'
          else '>3s'
        end`,
        count: sql<number>`count(*)::int`,
      })
      .from(usageLogs)
      .where(gte(usageLogs.createdAt, since))
      .groupBy(sql`case 
        when ${usageLogs.latencyMs} < 100 then '0-100ms'
        when ${usageLogs.latencyMs} < 300 then '100-300ms'
        when ${usageLogs.latencyMs} < 500 then '300-500ms'
        when ${usageLogs.latencyMs} < 1000 then '500ms-1s'
        when ${usageLogs.latencyMs} < 3000 then '1-3s'
        else '>3s'
      end`)
      .orderBy(sql`case 
        when ${usageLogs.latencyMs} < 100 then 1
        when ${usageLogs.latencyMs} < 300 then 2
        when ${usageLogs.latencyMs} < 500 then 3
        when ${usageLogs.latencyMs} < 1000 then 4
        when ${usageLogs.latencyMs} < 3000 then 5
        else 6
      end`),

    // 最近错误日志
    db
      .select({
        id: usageLogs.id,
        modelId: usageLogs.modelId,
        modelName: models.name,
        providerName: providers.name,
        errorMessage: usageLogs.errorMessage,
        latencyMs: usageLogs.latencyMs,
        createdAt: usageLogs.createdAt,
        // requestPath and statusCode not in schema yet
      })
      .from(usageLogs)
      .leftJoin(models, eq(usageLogs.modelId, models.modelId))
      .leftJoin(providers, eq(usageLogs.providerId, providers.id))
      .where(
        and(
          gte(usageLogs.createdAt, since),
          eq(usageLogs.status, 'error')
        )
      )
      .orderBy(desc(usageLogs.createdAt))
      .limit(20),

    // Provider 健康状态
    db
      .select({
        id: providers.id,
        name: providers.name,
        slug: providers.slug,
        status: providers.status,
        // responseTime: providers.responseTime,
      })
      .from(providers),

    // 活跃连接数
    getActiveConnections(),
  ]);

  const stats = requestStats[0];
  const latency = latencyStats[0];

  // 计算 QPS 和 TPS
  const qps = elapsedSeconds > 0 ? (stats.requests / elapsedSeconds) : 0;
  const tps = elapsedSeconds > 0 ? (Number(stats.tokens) / elapsedSeconds) : 0;

  // 计算错误分布百分比
  const totalErrors = errorStats.reduce((sum, e) => sum + e.count, 0);
  const errorDistributionWithPercent = errorStats.map(e => ({
    errorMessage: e.errorMessage?.slice(0, 30) || "Unknown",
    count: e.count,
    percent: totalErrors > 0 ? Math.round((e.count / totalErrors) * 100) : 0,
  }));

  // 计算延迟分布百分比
  const totalLatencyCount = latencyDistribution.reduce((sum, l) => sum + l.count, 0);
  const latencyDistributionWithPercent = latencyDistribution.map(l => ({
    range: l.range,
    count: l.count,
    percent: totalLatencyCount > 0 ? Math.round((l.count / totalLatencyCount) * 100) : 0,
  }));

  return NextResponse.json({
    realtime: {
      status: stats.requests > 0 ? "active" : "idle",
      qps: Number(qps.toFixed(2)),
      tps: Number(tps.toFixed(2)),
      requests: stats.requests,
      tokens: Number(stats.tokens),
      errors: stats.errors,
      successRate: Number(stats.successRate),
      activeConnections,
      avgResponseTime: stats.avgResponseTime,
    },
    latency: {
      p50: latency.p50,
      p90: latency.p90,
      p95: latency.p95,
      p99: latency.p99,
      avg: latency.avg,
      max: latency.max,
    },
    latencyDistribution: latencyDistributionWithPercent,
    providerDistribution,
    modelUsage,
    requestTrend,
    tokenTrend: tokenTrend.map(t => ({
      time: t.time,
      inputTokens: Number(t.inputTokens),
      outputTokens: Number(t.outputTokens),
      cost: Number(Number(t.cost).toFixed(4)),
    })),
    latencyTrend,
    errorTrend,
    errorDistribution: errorDistributionWithPercent,
    recentErrors,
    providerHealth: providerHealth,
  });
}
