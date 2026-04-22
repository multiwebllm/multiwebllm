import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usageLogs, apiKeys, providers, models } from "@/lib/db/schema";
import { validateAdmin } from "@/lib/auth";
import { eq, sql, gte, lte, desc, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // 分页
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
  const offset = (page - 1) * pageSize;

  // 时间范围
  const range = searchParams.get("range") || "24h";
  const granularity = searchParams.get("granularity") || "hour";

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

  // 筛选条件
  const filterModel = searchParams.get("model");
  const filterProvider = searchParams.get("provider");
  const filterStatus = searchParams.get("status");
  const filterKeyId = searchParams.get("keyId");

  // 构建 WHERE 条件
  const conditions = [gte(usageLogs.createdAt, since)];
  if (filterModel) {
    conditions.push(eq(usageLogs.modelId, filterModel));
  }
  if (filterProvider) {
    conditions.push(eq(usageLogs.providerId, parseInt(filterProvider, 10)));
  }
  if (filterStatus) {
    conditions.push(eq(usageLogs.status, filterStatus));
  }
  if (filterKeyId) {
    conditions.push(eq(usageLogs.apiKeyId, parseInt(filterKeyId, 10)));
  }

  const whereClause = and(...conditions);

  // 并行查询: 汇总 + 分页数据 + 图表数据
  const [
    summaryResult,
    totalCountResult,
    logsResult,
    modelDistResult,
    providerDistResult,
    tokenTrendResult,
  ] = await Promise.all([
    // 汇总统计
    db
      .select({
        totalRequests: sql<number>`count(*)::int`,
        totalTokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)::bigint`,
        totalCost: sql<number>`round(coalesce(sum(${usageLogs.totalTokens}), 0)::numeric / 1000 * 0.01, 4)`,
        avgLatency: sql<number>`coalesce(avg(${usageLogs.latencyMs}), 0)::int`,
        promptTokens: sql<number>`coalesce(sum(${usageLogs.promptTokens}), 0)::bigint`,
        completionTokens: sql<number>`coalesce(sum(${usageLogs.completionTokens}), 0)::bigint`,
      })
      .from(usageLogs)
      .where(whereClause),

    // 总条数
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(usageLogs)
      .where(whereClause),

    // 分页日志
    db
      .select({
        id: usageLogs.id,
        apiKeyId: usageLogs.apiKeyId,
        apiKeyName: apiKeys.name,
        modelId: usageLogs.modelId,
        modelName: models.name,
        providerId: usageLogs.providerId,
        providerName: providers.name,
        promptTokens: usageLogs.promptTokens,
        completionTokens: usageLogs.completionTokens,
        totalTokens: usageLogs.totalTokens,
        latencyMs: usageLogs.latencyMs,
        status: usageLogs.status,
        errorMessage: usageLogs.errorMessage,
        createdAt: usageLogs.createdAt,
      })
      .from(usageLogs)
      .leftJoin(models, eq(usageLogs.modelId, models.modelId))
      .leftJoin(providers, eq(usageLogs.providerId, providers.id))
      .leftJoin(apiKeys, eq(usageLogs.apiKeyId, apiKeys.id))
      .where(whereClause)
      .orderBy(desc(usageLogs.createdAt))
      .limit(pageSize)
      .offset(offset),

    // 模型分布 (top 10)
    db
      .select({
        modelId: usageLogs.modelId,
        modelName: models.name,
        requests: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)::int`,
        cost: sql<number>`round(coalesce(sum(${usageLogs.totalTokens}), 0)::numeric / 1000 * 0.01, 4)`,
      })
      .from(usageLogs)
      .leftJoin(models, eq(usageLogs.modelId, models.modelId))
      .where(whereClause)
      .groupBy(usageLogs.modelId, models.name)
      .orderBy(desc(sql`count(*)`))
      .limit(10),

    // provider 分布
    db
      .select({
        providerId: usageLogs.providerId,
        providerName: providers.name,
        requests: sql<number>`count(*)::int`,
        tokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)::int`,
        cost: sql<number>`round(coalesce(sum(${usageLogs.totalTokens}), 0)::numeric / 1000 * 0.01, 4)`,
      })
      .from(usageLogs)
      .leftJoin(providers, eq(usageLogs.providerId, providers.id))
      .where(whereClause)
      .groupBy(usageLogs.providerId, providers.name)
      .orderBy(desc(sql`count(*)`)),

    // Token 使用趋势
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
          cost: sql<number>`round(coalesce(sum(${usageLogs.totalTokens}), 0)::numeric / 1000 * 0.01, 4)`,
        })
        .from(usageLogs)
        .where(whereClause)
        .groupBy(timeExpr)
        .orderBy(timeExpr);
    })(),
  ]);

  const summary = summaryResult[0];
  const totalCount = totalCountResult[0].count;

  return NextResponse.json({
    // 顶部汇总
    summary: {
      totalRequests: summary.totalRequests,
      totalTokens: Number(summary.totalTokens),
      totalCost: Number(summary.totalCost),
      avgLatency: summary.avgLatency,
      promptTokens: Number(summary.promptTokens),
      completionTokens: Number(summary.completionTokens),
    },
    // 图表
    charts: {
      modelDistribution: modelDistResult,
      providerDistribution: providerDistResult,
      tokenTrend: tokenTrendResult,
    },
    // 分页日志
    logs: logsResult,
    pagination: {
      page,
      pageSize,
      total: totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  });
}
