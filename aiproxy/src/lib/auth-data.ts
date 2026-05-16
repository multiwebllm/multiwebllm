import { stampAuthRecord } from "./auth-meta";

/**
 * 解析/压缩 Cookie 导入（浏览器扩展 JSON、Cookie 字符串等）
 */

export interface NormalizedAuthData {
  cookies: Record<string, string> | string;
  token?: string;
  accessToken?: string;
  snlm0e?: string;
  orgId?: string;
}

function domainMatchesHost(cookieDomain: string, host: string): boolean {
  const d = cookieDomain.replace(/^\./, "").toLowerCase();
  const h = host.toLowerCase();
  if (!d) return true;
  return h === d || h.endsWith(`.${d}`) || d.endsWith(h);
}

function extractHost(baseUrl?: string): string | null {
  if (!baseUrl?.trim()) return null;
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return null;
  }
}

function cookieArrayToMap(
  items: unknown[],
  baseUrl?: string
): Record<string, string> {
  const host = extractHost(baseUrl);
  const map: Record<string, string> = {};

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const name = c.name;
    const value = c.value;
    if (typeof name !== "string" || !name) continue;
    if (value === undefined || value === null) continue;

    if (host) {
      const domain = typeof c.domain === "string" ? c.domain : "";
      if (domain && !domainMatchesHost(domain, host)) continue;
    }

    map[name] = String(value);
  }

  return map;
}

function pickExtras(obj: Record<string, unknown>): Partial<NormalizedAuthData> {
  const extra: Partial<NormalizedAuthData> = {};
  if (typeof obj.token === "string" && obj.token) extra.token = obj.token;
  if (typeof obj.accessToken === "string" && obj.accessToken) {
    extra.accessToken = obj.accessToken;
  }
  if (typeof obj.snlm0e === "string" && obj.snlm0e) extra.snlm0e = obj.snlm0e;
  if (typeof obj.orgId === "string" && obj.orgId) extra.orgId = obj.orgId;
  return extra;
}

/** 将任意粘贴内容规范为紧凑 authData 对象 */
export function normalizeAuthInput(
  raw: string,
  baseUrl?: string
): NormalizedAuthData {
  const trimmed = raw.trim();
  if (!trimmed) return { cookies: {} };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { cookies: trimmed };
  }

  if (Array.isArray(parsed)) {
    return { cookies: cookieArrayToMap(parsed, baseUrl) };
  }

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;

    if (Array.isArray(obj.cookies)) {
      return { cookies: cookieArrayToMap(obj.cookies, baseUrl), ...pickExtras(obj) };
    }

    if (obj.cookies && typeof obj.cookies === "object" && !Array.isArray(obj.cookies)) {
      return {
        cookies: obj.cookies as Record<string, string>,
        ...pickExtras(obj),
      };
    }

    if (typeof obj.cookies === "string") {
      return { cookies: obj.cookies, ...pickExtras(obj) };
    }

    // 已是 { "SID": "...", ... } 形式
    const allStringValues = Object.values(obj).every((v) => typeof v === "string");
    if (allStringValues && !obj.token && !obj.accessToken) {
      return { cookies: obj as Record<string, string> };
    }

    const extras = pickExtras(obj);
    if (extras.token || extras.accessToken) {
      return { cookies: {}, ...extras };
    }
  }

  return { cookies: trimmed };
}

/** 紧凑 JSON，避免 textarea 撑爆页面 */
export function serializeAuthData(data: NormalizedAuthData): string {
  return JSON.stringify(data);
}

export function authDataToRecord(
  data: NormalizedAuthData
): Record<string, unknown> {
  return stampAuthRecord(data as unknown as Record<string, unknown>);
}

export function parseAuthDataString(
  raw: string,
  baseUrl?: string
): NormalizedAuthData {
  if (!raw.trim()) return { cookies: {} };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return normalizeAuthInput(JSON.stringify(parsed), baseUrl);
  } catch {
    return normalizeAuthInput(raw, baseUrl);
  }
}

export function countCookies(cookies: NormalizedAuthData["cookies"]): number {
  if (!cookies) return 0;
  if (typeof cookies === "string") {
    return cookies.split(";").filter((p) => p.trim().includes("=")).length;
  }
  return Object.keys(cookies).length;
}

export function describeAuthData(
  authDataStr: string,
  baseUrl?: string
): string {
  if (!authDataStr.trim()) return "未配置";
  try {
    const data = parseAuthDataString(authDataStr, baseUrl);
    const n = countCookies(data.cookies);
    const host = extractHost(baseUrl);
    if (n === 0) return "已填写认证数据";
    return host
      ? `已导入 ${n} 个 Cookie（匹配 ${host} 相关域名）`
      : `已导入 ${n} 个 Cookie`;
  } catch {
    return "已填写认证数据";
  }
}

/** 编辑时展示：仅紧凑一行，或摘要模式 */
export function formatAuthDataForEdit(
  authData: Record<string, unknown> | null | undefined
): string {
  if (!authData || Object.keys(authData).length === 0) return "";
  return JSON.stringify(authData);
}
