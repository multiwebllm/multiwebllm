"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Unplug,
  BrainCircuit,
  KeySquare,
  TrendingUp,
  SlidersHorizontal,
  LogOut,
  Sparkles,
  Shield,
  ArrowUpCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEffect, useState } from "react";

const CURRENT_VERSION = "0.0.1";
const VERSION_CHECK_URL = "https://api.multiwebllm.io/v1/version";

const navItems = [
  { href: "/dashboard", label: "控制台", icon: LayoutDashboard },
  { href: "/dashboard/providers", label: "服务商管理", icon: Unplug },
  { href: "/dashboard/models", label: "模型配置", icon: BrainCircuit },
  { href: "/dashboard/keys", label: "API 密钥", icon: KeySquare },
  { href: "/dashboard/usage", label: "用量统计", icon: TrendingUp },
  { href: "/dashboard/settings", label: "系统设置", icon: SlidersHorizontal },
];

interface VersionInfo {
  latest: string;
  current: string;
  hasUpdate: boolean;
  changelog?: string;
  downloadUrl?: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [providerStatuses, setProviderStatuses] = useState<
    { name: string; status: string }[]
  >([]);
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);

  useEffect(() => {
    fetch("/api/admin/providers")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProviderStatuses(data);
      })
      .catch(() => {});

    // 检查新版本
    fetch(VERSION_CHECK_URL)
      .then((r) => r.json())
      .then((data) => {
        if (data.latest && data.latest !== CURRENT_VERSION) {
          setVersionInfo({
            latest: data.latest,
            current: CURRENT_VERSION,
            hasUpdate: true,
            changelog: data.changelog,
            downloadUrl: data.downloadUrl || "https://github.com/gentpan/multiwebllm/releases",
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
          <div className="flex h-14 items-center justify-between border-b px-5">
            <a href="https://multiwebllm.io" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <div className="flex h-8 w-8 items-center justify-center bg-blue-600">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-blue-600 leading-tight">MultiWebLLM</span>
                <span className="text-[10px] text-muted-foreground/50 leading-tight">v{CURRENT_VERSION}</span>
              </div>
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

          {/* Provider Status */}
          <div className="border-t p-3">
            <p className="mb-2 px-3 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              服务状态
            </p>
            <div className="space-y-0.5">
              {providerStatuses.length > 0 ? (
                providerStatuses.map((p) => (
                  <Tooltip key={p.name}>
                    <TooltipTrigger className="flex items-center gap-2.5 px-3 py-1.5 text-sm text-muted-foreground w-full text-left hover:bg-blue-50/50 dark:hover:bg-blue-950/50 transition-colors">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full ring-2",
                          p.status === "active"
                            ? "bg-emerald-500 ring-emerald-500/20"
                            : p.status === "error"
                            ? "bg-red-500 ring-red-500/20"
                            : "bg-gray-400 ring-gray-400/20"
                        )}
                      />
                      {p.name}
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {p.status === "active" ? "运行中" : p.status === "error" ? "异常" : "未启用"}
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
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400 transition-colors"
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
