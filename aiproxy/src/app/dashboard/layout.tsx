"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogOut,
  Sparkles,
  Shield,
  ArrowUpCircle,
  X,
  Activity,
  Loader2,
  RotateCw,
} from "lucide-react";
import { dashboardNavItems } from "@/lib/dashboard/nav-guide";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";

const CURRENT_VERSION = "0.0.2";
const VERSION_CHECK_URL = "https://api.multiwebllm.io/v1/version";

interface VersionInfo {
  latest: string;
  current: string;
  hasUpdate: boolean;
  changelog?: string;
  downloadUrl?: string;
}

interface ProviderStatusRow {
  slug: string;
  name: string;
  baseUrl: string;
  status: string;
  latencyMs: number | null;
  reachable: boolean;
  httpStatus?: number;
  error?: string;
}

function providerFaviconDomain(baseUrl: string, slug: string): string {
  try {
    if (baseUrl?.trim()) {
      return new URL(baseUrl).hostname;
    }
  } catch {
    // ignore invalid URL
  }
  return slug;
}

function formatLatencyLabel(
  status: string,
  latencyMs: number | null,
  reachable: boolean
): string {
  if (status !== "active") return "未启用";
  if (!reachable || latencyMs === null) return "超时";
  return `${latencyMs} ms`;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatusRow[]>(
    []
  );
  const [statusLoading, setStatusLoading] = useState(true);
  const [latencyLoading, setLatencyLoading] = useState(false);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);

  const loadProviderStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/admin/providers/status", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data.providers)) return;
      setProviderStatuses(
        data.providers.map(
          (p: ProviderStatusRow & { models?: unknown }) => ({
            slug: p.slug,
            name: p.name,
            baseUrl: p.baseUrl,
            status: p.status,
            latencyMs: null,
            reachable: false,
          })
        )
      );
    } catch {
      // ignore
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadProviderLatency = useCallback(async () => {
    setLatencyLoading(true);
    try {
      const res = await fetch("/api/admin/providers/latency", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data.providers)) return;

      type LatencyProbe = {
        slug: string;
        latencyMs: number | null;
        reachable: boolean;
        httpStatus?: number;
        error?: string;
      };
      const latencyBySlug = new Map<string, LatencyProbe>(
        (data.providers as LatencyProbe[]).map((p) => [p.slug, p])
      );

      setProviderStatuses((prev) =>
        prev.map((row) => {
          const probe = latencyBySlug.get(row.slug);
          if (!probe) return row;
          return {
            ...row,
            latencyMs: probe.latencyMs,
            reachable: probe.reachable,
            httpStatus: probe.httpStatus,
            error: probe.error,
          };
        })
      );
    } catch {
      // ignore
    } finally {
      setLatencyLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await loadProviderStatus();
      await loadProviderLatency();
    })();
    const timer = setInterval(() => void loadProviderLatency(), 60_000);
    return () => clearInterval(timer);
  }, [loadProviderStatus, loadProviderLatency]);

  useEffect(() => {
    fetch(VERSION_CHECK_URL)
      .then((r) => r.json())
      .then((data) => {
        if (data.latest && data.latest !== CURRENT_VERSION) {
          setVersionInfo({
            latest: data.latest,
            current: CURRENT_VERSION,
            hasUpdate: true,
            changelog: data.changelog,
            downloadUrl:
              data.downloadUrl ||
              "https://github.com/gentpan/multiwebllm/releases",
          });
        }
      })
      .catch(() => {
        // 版本检查失败不影响使用
      });
  }, []);

  return (
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <aside className="flex w-64 flex-col border-r bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
          {/* Logo */}
          <div className="flex h-14 shrink-0 items-center border-b px-3">
            <a
              href="https://multiwebllm.io"
              target="_blank"
              rel="noopener noreferrer"
              title="MultiWebLLM"
              className="flex w-full flex-nowrap items-center gap-2.5 hover:opacity-80 transition-opacity"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-base font-bold leading-none tracking-tight text-blue-600">
                MultiWebLLM
              </span>
              <span className="ml-auto inline-flex shrink-0 items-center rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground dark:bg-slate-800">
                v{CURRENT_VERSION}
              </span>
            </a>
          </div>

          {/* Update Banner */}
          {versionInfo?.hasUpdate && !dismissedUpdate && (
            <div className="mx-3 mt-3 flex items-start gap-2 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 p-2.5 text-xs">
              <ArrowUpCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-blue-700 dark:text-blue-300">
                  新版本 v{versionInfo.latest}
                </p>
                <a
                  href={versionInfo.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  查看更新
                </a>
              </div>
              <button
                onClick={() => setDismissedUpdate(true)}
                className="text-blue-400 hover:text-blue-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-3">
            <p className="mb-2 px-3 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              导航
            </p>
            {dashboardNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" &&
                  pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={`${item.label} — ${item.description}`}
                  className={cn(
                    "flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150",
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-muted-foreground hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950 dark:hover:text-blue-300"
                  )}
                >
                  <item.icon
                    className={cn(
                      "mt-0.5 h-[18px] w-[18px] shrink-0",
                      isActive ? "opacity-100" : "opacity-70"
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium leading-tight">
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block text-[11px] font-normal leading-snug",
                        isActive
                          ? "text-blue-100"
                          : "text-muted-foreground/80"
                      )}
                    >
                      {item.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* 服务状态：先展示服务商，再异步测速 */}
          <div className="border-t p-3">
            <div className="mb-2 flex items-center gap-1.5 px-3">
              <Activity className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
              <p className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                服务状态
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-blue-600"
                disabled={
                  latencyLoading ||
                  (statusLoading && providerStatuses.length === 0)
                }
                onClick={() => void loadProviderLatency()}
                title="重新测速"
              >
                {latencyLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCw className="h-3 w-3" />
                )}
                <span className="ml-1">重新测试</span>
              </Button>
            </div>
            <div className="max-h-[min(40vh,280px)] space-y-2 overflow-y-auto">
              {statusLoading && providerStatuses.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-5">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <p className="text-xs text-muted-foreground/70">
                    正在加载…
                  </p>
                </div>
              ) : providerStatuses.length > 0 ? (
                providerStatuses.map((p) => {
                  const faviconDomain = providerFaviconDomain(
                    p.baseUrl,
                    p.slug
                  );
                  return (
                    <div
                      key={p.slug}
                      className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-sm text-muted-foreground"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <img
                          src={`https://favicon.im/${faviconDomain}`}
                          alt={`${faviconDomain} favicon`}
                          loading="lazy"
                          width={16}
                          height={16}
                          className="h-4 w-4 shrink-0 rounded-sm object-contain"
                        />
                        <span className="truncate font-medium">{p.name}</span>
                      </span>
                      <span
                        className={cn(
                          "flex h-4 min-w-[3rem] shrink-0 items-center justify-end tabular-nums text-xs",
                          !latencyLoading &&
                            p.status === "active" &&
                            p.reachable &&
                            p.latencyMs !== null
                            ? "text-muted-foreground"
                            : !latencyLoading && p.status === "active"
                              ? "text-red-500"
                              : "text-muted-foreground/50"
                        )}
                      >
                        {latencyLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                        ) : (
                          formatLatencyLabel(
                            p.status,
                            p.latencyMs,
                            p.reachable
                          )
                        )}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center gap-2 px-3 py-2">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground/70">
                    尚未配置服务商
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Logout */}
          <div className="border-t p-3">
            <Link
              href="/login"
              className="flex w-full items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400 transition-colors"
            >
              <LogOut className="h-[18px] w-[18px] opacity-70" />
              退出登录
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-slate-50/50 dark:bg-background">
          <div className="p-6">{children}</div>
        </main>
      </div>
  );
}
