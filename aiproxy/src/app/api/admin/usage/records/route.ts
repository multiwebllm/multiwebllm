import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usageLogs, apiKeys, providers, models } from "@/lib/db/schema";
import { validateAdmin } from "@/lib/auth";
import { eq, sql, gte, desc, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = Math.min(
    parseInt(searchParams.get("pageSize") || "20", 10),
    100
  );
  const offset = (page - 1) * pageSize;

  const range = searchParams.get("range") || "24h";

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

  const filterModel = searchParams.get("model")?.trim();
  const filterProvider = searchParams.get("provider")?.trim();
  const filterStatus = searchParams.get("status")?.trim();
  const filterKeyName = searchParams.get("keyName")?.trim();

  const conditions = [gte(usageLogs.createdAt, since)];

  if (filterModel) {
    conditions.push(
      sql`${usageLogs.modelId} ilike ${"%" + filterModel + "%"}`
    );
  }
  if (filterStatus) {
    conditions.push(eq(usageLogs.status, filterStatus));
  }
  if (filterProvider) {
    conditions.push(sql`exists (
      select 1 from providers p
      where p.id = ${usageLogs.providerId}
      and p.name ilike ${"%" + filterProvider + "%"}
    )`);
  }
  if (filterKeyName) {
    conditions.push(sql`exists (
      select 1 from api_keys ak
      where ak.id = ${usageLogs.apiKeyId}
      and ak.name ilike ${"%" + filterKeyName + "%"}
    )`);
  }

  const whereClause = and(...conditions);

  const [summaryResult, totalCountResult, logsResult] = await Promise.all([
    db
      .select({
        totalRequests: sql<number>`count(*)::int`,
        totalTokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}), 0)::bigint`,
        avgLatency: sql<number>`coalesce(avg(${usageLogs.latencyMs}), 0)::int`,
        promptTokens: sql<number>`coalesce(sum(${usageLogs.promptTokens}), 0)::bigint`,
        completionTokens: sql<number>`coalesce(sum(${usageLogs.completionTokens}), 0)::bigint`,
        errors: sql<number>`count(*) filter (where ${usageLogs.status} = 'error')::int`,
        successRate: sql<number>`
          case when count(*) = 0 then 100
          else round((count(*) filter (where ${usageLogs.status} = 'success')::numeric / count(*)::numeric) * 100, 1)
          end
        `,
      })
      .from(usageLogs)
      .where(whereClause),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(usageLogs)
      .where(whereClause),

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
  ]);

  const summary = summaryResult[0];
  const totalCount = totalCountResult[0].count;

  return NextResponse.json({
    summary: {
      totalRequests: summary.totalRequests,
      totalTokens: Number(summary.totalTokens),
      avgLatency: summary.avgLatency,
      promptTokens: Number(summary.promptTokens),
      completionTokens: Number(summary.completionTokens),
      errors: summary.errors,
      successRate: Number(summary.successRate),
    },
    logs: logsResult,
    pagination: {
      page,
      pageSize,
      total: totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  });
}
