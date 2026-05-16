import { db } from "@/lib/db";
import { providers } from "@/lib/db/schema";
import { getProvider } from "@/lib/providers";
import { countCookies } from "@/lib/auth-data";
import { getAuthAgeDays, isAuthStale } from "@/lib/auth-meta";
import type { HealthCheckSummary } from "@/lib/settings";
import { eq } from "drizzle-orm";

export interface ProviderHealthResult {
  id: number;
  name: string;
  slug: string;
  ok: boolean;
  message: string;
  authAgeDays: number | null;
  needsRelogin: boolean;
  skipped: boolean;
}

function hasAuthConfigured(
  authType: string,
  authData: Record<string, unknown> | null
): boolean {
  if (!authData || Object.keys(authData).length === 0) return false;
  if (authType === "cookie") {
    const cookies = authData.cookies;
    if (!cookies) return false;
    return countCookies(cookies as Parameters<typeof countCookies>[0]) > 0;
  }
  if (authType === "token") {
    return Boolean(authData.token || authData.accessToken);
  }
  if (authType === "api_key") {
    return Boolean(authData.key || authData.apiKey || authData.api_key);
  }
  return true;
}

export async function checkProviderHealth(
  providerId: number,
  options?: { reloginRemindDays?: number; updateDb?: boolean }
): Promise<ProviderHealthResult | null> {
  const rows = await db
    .select()
    .from(providers)
    .where(eq(providers.id, providerId))
    .limit(1);

  if (rows.length === 0) return null;

  const record = rows[0];
  const authData = (record.authData as Record<string, unknown>) ?? {};
  const reloginRemindDays = options?.reloginRemindDays ?? 7;
  const authAgeDays = getAuthAgeDays(authData);
  const needsRelogin = isAuthStale(authData, reloginRemindDays);

  if (!hasAuthConfigured(record.authType, authData)) {
    const result: ProviderHealthResult = {
      id: record.id,
      name: record.name,
      slug: record.slug,
      ok: false,
      message: "未配置认证数据",
      authAgeDays,
      needsRelogin: false,
      skipped: true,
    };
    if (options?.updateDb) {
      await db
        .update(providers)
        .set({
          status: "inactive",
          lastCheckedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(providers.id, providerId));
    }
    return result;
  }

  const checkedAt = new Date();

  try {
    const provider = getProvider(record.slug, {
      authData,
      baseUrl: record.baseUrl,
    });
    const valid = await provider.validateAuth();

    if (options?.updateDb) {
      await db
        .update(providers)
        .set({
          lastCheckedAt: checkedAt,
          status: valid ? "active" : "error",
          updatedAt: checkedAt,
        })
        .where(eq(providers.id, providerId));
    }

    let message = valid ? "连接正常" : "认证无效或已过期，请重新登录并更新 Cookie";
    if (valid && needsRelogin) {
      message = `连接正常，但 Cookie 已 ${authAgeDays} 天未更新，建议重新登录`;
    }

    return {
      id: record.id,
      name: record.name,
      slug: record.slug,
      ok: valid,
      message,
      authAgeDays,
      needsRelogin: valid && needsRelogin,
      skipped: false,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "未知错误";

    if (options?.updateDb) {
      await db
        .update(providers)
        .set({
          lastCheckedAt: checkedAt,
          status: "error",
          updatedAt: checkedAt,
        })
        .where(eq(providers.id, providerId));
    }

    return {
      id: record.id,
      name: record.name,
      slug: record.slug,
      ok: false,
      message: `检测失败：${message}`,
      authAgeDays,
      needsRelogin,
      skipped: false,
    };
  }
}

export async function runAllProvidersHealthCheck(options: {
  reloginRemindDays: number;
  slugs?: string[];
}): Promise<HealthCheckSummary> {
  const all = await db.select().from(providers);
  const targets = options.slugs?.length
    ? all.filter((p) => options.slugs!.includes(p.slug))
    : all.filter((p) => ["chatgpt", "gemini"].includes(p.slug));

  const results: ProviderHealthResult[] = [];

  for (const p of targets) {
    const r = await checkProviderHealth(p.id, {
      reloginRemindDays: options.reloginRemindDays,
      updateDb: true,
    });
    if (r) results.push(r);
  }

  const checkedAt = new Date().toISOString();

  return {
    checkedAt,
    intervalDays: 0,
    total: results.length,
    ok: results.filter((r) => r.ok && !r.needsRelogin).length,
    failed: results.filter((r) => !r.ok && !r.skipped).length,
    stale: results.filter((r) => r.needsRelogin).length,
    results: results.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      ok: r.ok,
      message: r.message,
      authAgeDays: r.authAgeDays,
      needsRelogin: r.needsRelogin,
    })),
  };
}

export function formatHealthReportForTelegram(
  summary: HealthCheckSummary,
  appName: string
): string {
  const lines: string[] = [
    `<b>${escapeHtml(appName)} 订阅连接巡检</b>`,
    `时间：${escapeHtml(summary.checkedAt)}`,
    `检测：${summary.total} 个 · 正常 ${summary.ok} · 异常 ${summary.failed} · 建议续期 ${summary.stale}`,
    "",
  ];

  for (const r of summary.results) {
    const icon = !r.ok ? "❌" : r.needsRelogin ? "⚠️" : "✅";
    const age =
      r.authAgeDays !== null ? `（Cookie ${r.authAgeDays} 天前更新）` : "";
    lines.push(
      `${icon} <b>${escapeHtml(r.name)}</b>：${escapeHtml(r.message)}${escapeHtml(age)}`
    );
  }

  if (summary.failed > 0 || summary.stale > 0) {
    lines.push(
      "",
      "请到管理后台 → 服务商 → 一键授权，重新登录并获取 Cookie。"
    );
  }

  return lines.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
