import type { ProviderModel } from "@/lib/providers/base";
import type { ProviderConfig } from "@/lib/providers/base";
import {
  dedupeProviderModels,
  extractModelList,
  fetchJsonWithTimeout,
  finalizeProviderModels,
  normalizeOfficialModel,
} from "./normalize";

type HeadersInit = Record<string, string>;

function parseCookies(cookies: Record<string, string> | string): string {
  if (typeof cookies === "string") return cookies;
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function buildHeaders(
  config: ProviderConfig,
  extra: HeadersInit = {}
): HeadersInit {
  const cookies = config.authData.cookies as Record<string, string> | string | undefined;
  const token = config.authData.token as string | undefined;
  const accessToken = config.authData.accessToken as string | undefined;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    ...extra,
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  else if (token) headers["Authorization"] = `Bearer ${token}`;
  if (cookies) headers["Cookie"] = parseCookies(cookies);
  return headers;
}

function parseOfficialList(
  providerSlug: string,
  data: unknown
): ProviderModel[] {
  const items = extractModelList(data);
  const models = items
    .map((item) => normalizeOfficialModel(providerSlug, item))
    .filter((m): m is ProviderModel => m !== null);
  return dedupeProviderModels(models);
}

async function tryUrls(
  providerSlug: string,
  urls: string[],
  headers: HeadersInit
): Promise<ProviderModel[]> {
  for (const url of urls) {
    const data = await fetchJsonWithTimeout(url, { headers });
    if (!data) continue;
    const models = parseOfficialList(providerSlug, data);
    if (models.length > 0) return models;
  }
  return [];
}

export async function fetchChatGPTModels(
  config: ProviderConfig,
  baseUrl: string,
  getAccessToken: () => Promise<string | null>
): Promise<ProviderModel[]> {
  const token = await getAccessToken();
  if (!token) {
    return finalizeProviderModels("chatgpt", []);
  }

  const headers = buildHeaders(config, { Authorization: `Bearer ${token}` });
  const official = await tryUrls(
    "chatgpt",
    [
      `${baseUrl}/backend-api/models`,
      `${baseUrl}/backend-api/conversation/model_configs`,
      `${baseUrl}/backend-api/settings/user`,
    ],
    headers
  );
  return finalizeProviderModels("chatgpt", official);
}

export async function fetchClaudeModels(
  config: ProviderConfig,
  baseUrl: string,
  getOrgId: () => Promise<string | null>
): Promise<ProviderModel[]> {
  const headers = buildHeaders(config, {
    "Anthropic-Client-Sha": "unknown",
    "Anthropic-Client-Version": "unknown",
  });

  const orgId = await getOrgId();
  const urls = [
    `${baseUrl}/api/models`,
    `${baseUrl}/api/bootstrap`,
    `${baseUrl}/api/account`,
  ];
  if (orgId) {
    urls.unshift(`${baseUrl}/api/organizations/${orgId}/models`);
    urls.push(`${baseUrl}/api/organizations/${orgId}/list_models`);
  }

  const official = await tryUrls("claude", urls, headers);
  return finalizeProviderModels("claude", official);
}

export async function fetchDeepSeekModels(
  config: ProviderConfig,
  baseUrl: string
): Promise<ProviderModel[]> {
  const headers = buildHeaders(config, { Accept: "application/json" });
  const official = await tryUrls(
    "deepseek",
    [
      `${baseUrl}/api/v0/models`,
      `${baseUrl}/api/v0/model_configs`,
    ],
    headers
  );
  return finalizeProviderModels("deepseek", official);
}

export async function fetchKimiModels(
  config: ProviderConfig,
  baseUrl: string
): Promise<ProviderModel[]> {
  const headers = buildHeaders(config, { "R-Timezone": "Asia/Shanghai" });
  const official = await tryUrls(
    "kimi",
    [
      `${baseUrl}/api/models`,
      `${baseUrl}/api/chat/models`,
      `${baseUrl}/api/config/models`,
      `${baseUrl}/api/user/models`,
    ],
    headers
  );

  if (official.length === 0) {
    const userData = await fetchJsonWithTimeout(`${baseUrl}/api/user`, {
      headers,
    });
    if (userData) {
      const fromUser = parseOfficialList("kimi", userData);
      if (fromUser.length > 0) {
        return finalizeProviderModels("kimi", fromUser);
      }
    }
  }

  return finalizeProviderModels("kimi", official);
}

export async function fetchGrokModels(
  config: ProviderConfig,
  baseUrl: string
): Promise<ProviderModel[]> {
  const headers = buildHeaders(config);
  const official = await tryUrls(
    "grok",
    [
      `${baseUrl}/rest/models`,
      `${baseUrl}/rest/app-chat/models`,
      `${baseUrl}/rest/products/models`,
    ],
    headers
  );
  return finalizeProviderModels("grok", official);
}

export async function fetchGeminiModels(
  config: ProviderConfig,
  baseUrl: string
): Promise<ProviderModel[]> {
  const headers = buildHeaders(config, { "X-Same-Domain": "1" });
  const official = await tryUrls("gemini", [`${baseUrl}/app/models`], headers);
  return finalizeProviderModels("gemini", official);
}

export async function fetchMinimaxModels(
  config: ProviderConfig,
  baseUrl: string
): Promise<ProviderModel[]> {
  const headers = buildHeaders(config);
  const official = await tryUrls(
    "minimax",
    [
      `${baseUrl}/api/models`,
      `${baseUrl}/api/chat/models`,
      `${baseUrl}/v1/api/models/list`,
    ],
    headers
  );

  if (official.length === 0) {
    const userData = await fetchJsonWithTimeout(`${baseUrl}/api/user/info`, {
      headers,
    });
    if (userData) {
      const parsed = parseOfficialList("minimax", userData);
      if (parsed.length > 0) {
        return finalizeProviderModels("minimax", parsed);
      }
    }
  }

  return finalizeProviderModels("minimax", official);
}

export async function fetchDoubaoModels(
  config: ProviderConfig,
  baseUrl: string
): Promise<ProviderModel[]> {
  const headers = buildHeaders(config);
  const official = await tryUrls(
    "doubao",
    [
      `${baseUrl}/alice/api/models`,
      `${baseUrl}/alice/api/model/list`,
      `${baseUrl}/alice/api/bots/models`,
    ],
    headers
  );

  if (official.length === 0) {
    const userData = await fetchJsonWithTimeout(`${baseUrl}/alice/api/user/info`, {
      headers,
    });
    if (userData) {
      const parsed = parseOfficialList("doubao", userData);
      if (parsed.length > 0) {
        return finalizeProviderModels("doubao", parsed);
      }
    }
  }

  return finalizeProviderModels("doubao", official);
}
