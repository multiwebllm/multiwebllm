"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Unplug,
  BrainCircuit,
  KeySquare,
  SlidersHorizontal,
  LogOut,
  Sparkles,
  Shield,
  ArrowUpCircle,
  X,
  Monitor,
  ScrollText,
  Activity,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCallback, useEffect, useState } from "react";

const CURRENT_VERSION = "0.0.1";
const VERSION_CHECK_URL = "https://api.multiwebllm.io/v1/version";

const navItems = [
  { href: "/dashboard", label: "控制台", icon: LayoutDashboard },
  { href: "/dashboard/monitoring", label: "运维监控", icon: Monitor },
  { href: "/dashboard/records", label: "使用记录", icon: ScrollText },
  { href: "/dashboard/providers", label: "服务商管理", icon: Unplug },
  { href: "/dashboard/models", label: "模型配置", icon: BrainCircuit },
  { href: "/dashboard/keys", label: "API 密钥", icon: KeySquare },
  { href: "/dashboard/settings", label: "系统设置", icon: SlidersHorizontal },
];

interface VersionInfo {
  latest: string;
  current: string;
  hasUpdate: boolean;
  changelog?: string;
  downloadUrl?: string;
}

interface ProviderLatencyRow {
  slug: string;
  name: string;
  baseUrl: string;
  status: string;
  latencyMs: number | null;
  reachable: boolean;
  httpStatus?: number;
  error?: string;
}

function latencyDotClass(
  status: string,
  latencyMs: number | null,
  reachable: boolean
): string {
  if (status !== "active") {
    return "bg-gray-400 ring-gray-400/20";
  }
  if (!reachable || latencyMs === null) {
    return "bg-red-500 ring-red-500/20";
  }
  if (latencyMs < 500) {
    return "bg-emerald-500 ring-emerald-500/20";
  }
  if (latencyMs < 1500) {
    return "bg-amber-500 ring-amber-500/20";
  }
  return "bg-orange-500 ring-orange-500/20";
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
  const [providerStatuses, setProviderStatuses] = useState<ProviderLatencyRow[]>(
    []
  );
  const [latencyLoading, setLatencyLoading] = useState(true);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);

  const loadProviderLatency = useCallback(async () => {
    setLatencyLoading(true);
    try {
      const res = await fetch("/api/admin/providers/latency", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.providers)) {
        setProviderStatuses(data.providers);
      }
    } catch {
      // ignore
    } finally {
      setLatencyLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProviderLatency();
    const timer = setInterval(() => void loadProviderLatency(), 60_000);
    return () => clearInterval(timer);
  }, [loadProviderLatency]);

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
    <TooltipProvider>
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
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" &&
                  pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-muted-foreground hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950 dark:hover:text-blue-300"
                  )}
                >
                  <item.icon className={cn("h-[18px] w-[18px]", isActive ? "opacity-100" : "opacity-70")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Provider Status（异步检测官网延迟） */}
          <div className="border-t p-3">
            <div className="mb-2 flex items-center gap-2 px-3">
              <Activity className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
              <p className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                服务状态
              </p>
              {latencyLoading && (
                <Loader2
                  className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-600"
                  aria-label="正在检测"
                />
              )}
            </div>
            <div
              className={cn(
                "space-y-0.5 transition-opacity",
                latencyLoading && providerStatuses.length > 0 && "opacity-70"
              )}
            >
              {latencyLoading && providerStatuses.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-5">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <p className="text-xs text-muted-foreground/70">
                    正在检测官网延迟…
                  </p>
                </div>
              ) : providerStatuses.length > 0 ? (
                providerStatuses.map((p) => (
                  <Tooltip key={p.slug}>
                    <TooltipTrigger className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:bg-blue-50/50 dark:hover:bg-blue-950/50 transition-colors">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={cn(
                            "h-2 w-2 shrink-0 rounded-full ring-2",
                            latencyLoading
                              ? "bg-muted-foreground/30 ring-muted-foreground/10"
                              : latencyDotClass(
                                  p.status,
                                  p.latencyMs,
                                  p.reachable
                                )
                          )}
                        />
                        <span className="truncate">{p.name}</span>
                      </span>
                      <span
                        className={cn(
                          "flex h-4 min-w-[3rem] shrink-0 items-center justify-end tabular-nums text-xs font-medium",
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
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground break-all">
                        {p.baseUrl}
                      </p>
                      <p className="mt-1 text-xs">
                        {p.status !== "active"
                          ? "服务商未启用"
                          : p.reachable && p.latencyMs !== null
                            ? `服务器 → 官网：${p.latencyMs} ms${
                                p.httpStatus ? ` (HTTP ${p.httpStatus})` : ""
                              }`
                            : "无法连通或请求超时"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ))
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
    </TooltipProvider>
  );
}
