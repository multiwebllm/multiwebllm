const DEFAULT_TIMEOUT_MS = 10_000;

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed);
    return u.origin;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

/**
 * 从部署 MultiWebLLM 的服务器向服务商官网发起请求，测量首包耗时（毫秒）。
 */
export async function measureUrlLatency(
  baseUrl: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<{
  latencyMs: number | null;
  reachable: boolean;
  status?: number;
  error?: string;
}> {
  const url = normalizeBaseUrl(baseUrl);
  if (!url) {
    return { latencyMs: null, reachable: false, error: "invalid_url" };
  }

  const headers = {
    "User-Agent":
      "Mozilla/5.0 (compatible; MultiWebLLM/1.0; +https://multiwebllm.io)",
    Accept: "*/*",
  };

  for (const method of ["HEAD", "GET"] as const) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = performance.now();

    try {
      const res = await fetch(url, {
        method,
        signal: controller.signal,
        redirect: "follow",
        headers,
      });
      const latencyMs = Math.round(performance.now() - start);
      const reachable = res.status > 0 && res.status < 600;
      return {
        latencyMs,
        reachable,
        status: res.status,
      };
    } catch (err) {
      if (method === "GET") {
        const message =
          err instanceof Error ? err.message : "request_failed";
        return { latencyMs: null, reachable: false, error: message };
      }
    } finally {
      clearTimeout(timer);
    }
  }

  return { latencyMs: null, reachable: false, error: "request_failed" };
}

export async function measureProvidersLatency(
  items: { slug: string; name: string; baseUrl: string; status: string }[]
): Promise<
  {
    slug: string;
    name: string;
    baseUrl: string;
    status: string;
    latencyMs: number | null;
    reachable: boolean;
    httpStatus?: number;
    error?: string;
  }[]
> {
  const results = await Promise.all(
    items.map(async (p) => {
      if (p.status !== "active" || !p.baseUrl) {
        return {
          ...p,
          latencyMs: null,
          reachable: false,
          error: p.status !== "active" ? "inactive" : "no_base_url",
        };
      }

      const probe = await measureUrlLatency(p.baseUrl);
      return {
        ...p,
        latencyMs: probe.latencyMs,
        reachable: probe.reachable,
        httpStatus: probe.status,
        error: probe.error,
      };
    })
  );

  return results.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}
