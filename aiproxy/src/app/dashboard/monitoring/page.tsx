"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  AlertTriangle,
  Clock,
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  RefreshCw,
  TrendingUp,
  Layers,
  Coins,
  BarChart3,
  CheckCircle2,
  XCircle,
  Zap,
  ExternalLink,
  KeySquare,
  Unplug,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  ComposedChart,
} from "recharts";

interface MonitoringData {
  realtime: {
    qps: number;
    requests: number;
    tokens: number;
    errors: number;
    successRate: number;
    avgResponseTime: number;
    activeApiKeys: number;
  };
  latency: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    avg: number;
    max: number;
  };
  latencyDistribution: { range: string; count: number; percent: number }[];
  providerDistribution: {
    providerName: string;
    providerSlug: string;
    requests: number;
    tokens: number;
    errors: number;
    avgLatency: number;
  }[];
  modelUsage: {
    modelId: string;
    modelName: string;
    requests: number;
    tokens: number;
    providerName: string;
  }[];
  requestTrend: { time: string; requests: number; tokens: number; errors: number }[];
  tokenTrend: { time: string; inputTokens: number; outputTokens: number }[];
  latencyTrend: { time: string; p50: number; p99: number; avg: number }[];
  errorDistribution: { errorMessage: string; count: number; percent: number }[];
  recentErrors: {
    id: number;
    modelId: string;
    modelName: string;
    providerName: string;
    errorMessage: string;
    latencyMs: number;
    createdAt: string;
  }[];
  providersOverview: {
    id: number;
    name: string;
    slug: string;
    status: string;
    lastCheckedAt: string | null;
    requests: number;
    errors: number;
    avgLatency: number;
  }[];
  apiKeyTop: {
    keyId: number;
    keyName: string;
    requests: number;
    tokens: number;
  }[];
}

type TimeRange = "1min" | "5min" | "30min" | "1h" | "6h" | "24h";

interface SystemMetrics {
  hostname: string;
  cpu: { percent: number; cores: number };
  memory: { percent: number; usedGB: string; totalGB: string };
  disk: { percent: number; usedGB: string; totalGB: string };
  redis: {
    memoryPercent: number;
    opsPerSec: number;
    connectedClients: number;
    status?: string;
  };
  database: { status: string; size: string; connections: number };
  uptime: { days: number; hours: number; minutes: number };
}

const RANGE_LABELS: Record<TimeRange, string> = {
  "1min": "1 分钟",
  "5min": "5 分钟",
  "30min": "30 分钟",
  "1h": "1 小时",
  "6h": "6 小时",
  "24h": "24 小时",
};

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

function CircularGauge({
  value,
  max = 100,
  label,
  subLabel,
  color,
  size = 72,
  strokeWidth = 6,
  icon,
}: {
  value: number;
  max?: number;
  label: string;
  subLabel?: string;
  color: string;
  size?: number;
  strokeWidth?: number;
  icon?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clamped = Math.min(Math.max(value, 0), max);
  const strokeDashoffset = circumference - (clamped / max) * circumference;
  const barColor =
    clamped >= 90 ? "#ef4444" : clamped >= 70 ? "#f59e0b" : color;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 transform">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={barColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div style={{ color: barColor }}>{icon}</div>
        </div>
      </div>
      <div className="mt-1 text-center">
        <p className="text-[10px] font-semibold leading-tight">{label}</p>
        {subLabel && (
          <p className="text-[8px] leading-tight text-muted-foreground">
            {subLabel}
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-emerald-600",
    danger: "text-red-600",
    warning: "text-amber-600",
  }[tone];

  return (
    <Card className="rounded-xl border-0 shadow-sm">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-xl font-bold tabular-nums ${toneClass}`}>{value}</p>
          {sub && (
            <p className="text-[10px] text-muted-foreground">{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function providerStatusBadge(status: string) {
  if (status === "active") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
        启用
      </Badge>
    );
  }
  if (status === "error") {
    return <Badge variant="destructive">异常</Badge>;
  }
  return <Badge variant="secondary">停用</Badge>;
}

function formatCheckedAt(iso: string | null): string {
  if (!iso) return "未巡检";
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function EmptyChart({ hint }: { hint?: string }) {
  return (
    <div className="flex h-[140px] flex-col items-center justify-center text-muted-foreground">
      <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
        <BarChart3 className="h-5 w-5 text-slate-300" />
      </div>
      <p className="text-xs">暂无数据</p>
      {hint && (
        <p className="mt-1 max-w-[220px] text-center text-[10px] text-muted-foreground/80">
          {hint}
        </p>
      )}
    </div>
  );
}

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [sysMetrics, setSysMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("1h");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [monRes, sysRes] = await Promise.all([
        fetch(`/api/admin/monitoring?range=${range}`, { cache: "no-store" }),
        fetch("/api/admin/monitoring/system", { cache: "no-store" }),
      ]);
      if (monRes.ok) setData(await monRes.json());
      if (sysRes.ok) setSysMetrics(await sysRes.json());
      setLastUpdated(new Date());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-28 rounded-xl" />
      </div>
    );
  }

  const rt = data?.realtime;
  const lat = data?.latency;
  const hasUsage = (rt?.requests ?? 0) > 0;
  const chartHint =
    "通过 /v1/chat/completions 产生调用后，此处会显示统计图表";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">运维监控</h1>
            <Badge variant="outline" className="text-xs font-normal">
              {RANGE_LABELS[range]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              更新于 {lastUpdated.toLocaleTimeString("zh-CN")}
            </span>
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            趋势、延迟、错误与机器资源（1 分钟～24 小时）。逐条日志与 CSV 请见
            <Link href="/dashboard/records" className="mx-1 text-blue-600 hover:underline">
              使用记录
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/records"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-muted-foreground hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900"
          >
            调用明细
            <ExternalLink className="h-3 w-3" />
          </Link>
          <Link
            href="/dashboard/providers"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-muted-foreground hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900"
          >
            服务商
            <ExternalLink className="h-3 w-3" />
          </Link>
          <Select value={range} onValueChange={(v) => setRange(v as TimeRange)}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RANGE_LABELS) as TimeRange[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {RANGE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`rounded-lg border p-2 text-sm ${
              autoRefresh
                ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                : "border-slate-200 bg-white"
            }`}
            title={autoRefresh ? "每 10 秒刷新" : "已暂停自动刷新"}
          >
            <RefreshCw
              className={`h-4 w-4 ${autoRefresh ? "animate-spin" : ""}`}
              style={{ animationDuration: "3s" }}
            />
          </button>
          <button
            type="button"
            onClick={() => void fetchData()}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs hover:bg-slate-50"
          >
            立即刷新
          </button>
        </div>
      </div>

      {!hasUsage && (
        <Card className="border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30">
          <CardContent className="flex items-start gap-3 py-3 text-sm text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              当前时间范围内尚无 API 调用记录。业务指标与图表会在通过网关发起聊天请求后出现；下方基础设施数据来自本机容器。
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard
          label="请求数"
          value={String(rt?.requests ?? 0)}
          sub={`QPS ${(rt?.qps ?? 0).toFixed(2)}`}
          icon={<Zap className="h-4 w-4 text-blue-500" />}
        />
        <StatCard
          label="成功率"
          value={`${(rt?.successRate ?? 100).toFixed(1)}%`}
          sub={`${rt?.errors ?? 0} 次失败`}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          tone={
            (rt?.successRate ?? 100) < 95
              ? "danger"
              : (rt?.successRate ?? 100) < 99
                ? "warning"
                : "success"
          }
        />
        <StatCard
          label="平均延迟"
          value={`${rt?.avgResponseTime ?? 0} ms`}
          sub={`P99 ${lat?.p99 ?? 0} ms`}
          icon={<Clock className="h-4 w-4 text-amber-500" />}
        />
        <StatCard
          label="Token"
          value={formatTokenCount(rt?.tokens ?? 0)}
          sub="输入 + 输出合计"
          icon={<Coins className="h-4 w-4 text-violet-500" />}
        />
        <StatCard
          label="活跃 Key"
          value={String(rt?.activeApiKeys ?? 0)}
          sub="时间窗内有调用"
          icon={<KeySquare className="h-4 w-4 text-pink-500" />}
        />
      </div>

      {sysMetrics && (
        <details className="group rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground marker:content-none">
            <Activity className="h-4 w-4" />
            基础设施（{sysMetrics.hostname} · 运行{" "}
            {sysMetrics.uptime.days}天{sysMetrics.uptime.hours}时）
            <span className="ml-auto text-xs group-open:hidden">展开</span>
          </summary>
          <div className="border-t px-4 pb-4 pt-2">
            <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Database className="h-3.5 w-3.5" />
                PG {sysMetrics.database.status}
                {sysMetrics.database.size ? ` · ${sysMetrics.database.size}` : ""}
              </span>
              <span>
                Redis {sysMetrics.redis.connectedClients} 客户端 ·{" "}
                {sysMetrics.redis.opsPerSec} ops/s
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <CircularGauge
                value={sysMetrics.cpu.percent}
                label="CPU"
                subLabel={`${sysMetrics.cpu.cores} 核`}
                color="#3b82f6"
                icon={<Cpu className="h-4 w-4" />}
              />
              <CircularGauge
                value={sysMetrics.memory.percent}
                label="内存"
                subLabel={`${sysMetrics.memory.usedGB}/${sysMetrics.memory.totalGB} GB`}
                color="#8b5cf6"
                icon={<MemoryStick className="h-4 w-4" />}
              />
              <CircularGauge
                value={sysMetrics.disk.percent}
                label="磁盘"
                subLabel={`${sysMetrics.disk.usedGB}/${sysMetrics.disk.totalGB} GB`}
                color="#10b981"
                icon={<HardDrive className="h-4 w-4" />}
              />
              <CircularGauge
                value={sysMetrics.redis.memoryPercent}
                label="Redis"
                subLabel={sysMetrics.redis.memoryPercent > 0 ? "内存占用" : "—"}
                color="#f59e0b"
                icon={<Database className="h-4 w-4" />}
              />
            </div>
          </div>
        </details>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="rounded-xl border-0 shadow-sm">
          <CardContent className="pt-3 pb-2">
            <div className="mb-2 flex items-center gap-2">
              <Unplug className="h-4 w-4 text-cyan-500" />
              <span className="text-sm font-semibold">服务商状态</span>
            </div>
            {data?.providersOverview && data.providersOverview.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 pr-2 font-medium">名称</th>
                      <th className="py-2 pr-2 font-medium">状态</th>
                      <th className="py-2 pr-2 text-right font-medium">请求</th>
                      <th className="py-2 pr-2 text-right font-medium">错误</th>
                      <th className="py-2 pr-2 text-right font-medium">延迟</th>
                      <th className="py-2 text-right font-medium">巡检</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.providersOverview.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-2 font-medium">{p.name}</td>
                        <td className="py-2 pr-2">{providerStatusBadge(p.status)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {p.requests}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums text-red-600">
                          {p.errors}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">
                          {p.requests > 0 ? `${p.avgLatency} ms` : "—"}
                        </td>
                        <td className="py-2 text-right text-muted-foreground">
                          {formatCheckedAt(p.lastCheckedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyChart hint="请先在服务商管理中添加并启用服务商" />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-0 shadow-sm">
          <CardContent className="pt-3 pb-2">
            <div className="mb-2 flex items-center gap-2">
              <KeySquare className="h-4 w-4 text-pink-500" />
              <span className="text-sm font-semibold">API Key 用量 Top</span>
            </div>
            {data?.apiKeyTop && data.apiKeyTop.length > 0 ? (
              <div className="space-y-2">
                {data.apiKeyTop.map((k, i) => (
                  <div key={k.keyId} className="flex items-center gap-2">
                    <span className="w-4 text-center text-[10px] font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <span className="truncate text-xs font-medium">{k.keyName}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {k.requests} 次
                        </span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full rounded-full bg-slate-100">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{
                            width: `${Math.min((k.requests / (data.apiKeyTop[0]?.requests || 1)) * 100, 100)}%`,
                            backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatTokenCount(k.tokens)} Token
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyChart hint={chartHint} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 grid-cols-3">
        <Card className="col-span-2 rounded-xl border-0 shadow-sm">
          <CardContent className="pt-3 pb-2">
            <div className="mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-semibold">综合趋势</span>
            </div>
            {data?.requestTrend && data.requestTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={data.requestTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "8px" }} />
                  <Area yAxisId="left" type="monotone" dataKey="requests" stroke="#3b82f6" fill="#3b82f640" strokeWidth={2} name="请求" />
                  <Area yAxisId="right" type="monotone" dataKey="tokens" stroke="#a855f7" fill="#a855f740" strokeWidth={2} name="Token" />
                  <Line yAxisId="left" type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} dot={false} name="错误" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart hint={chartHint} />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-0 shadow-sm">
          <CardContent className="pt-3 pb-2">
            <div className="mb-2 flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold">Token 输入/输出</span>
            </div>
            {data?.tokenTrend && data.tokenTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data.tokenTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "8px" }} />
                  <Area type="monotone" dataKey="inputTokens" stackId="1" stroke="#10b981" fill="#10b981" name="输入" />
                  <Area type="monotone" dataKey="outputTokens" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="输出" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart hint={chartHint} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 grid-cols-3">
        <Card className="col-span-2 rounded-xl border-0 shadow-sm">
          <CardContent className="pt-3 pb-2">
            <div className="mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold">延迟分析</span>
              <div className="ml-auto flex gap-2">
                {(["P50", "P90", "P99"] as const).map((p) => (
                  <Badge key={p} variant="outline" className="text-[9px]">
                    {p}:{" "}
                    {lat?.[p.toLowerCase() as keyof typeof lat] ?? 0}ms
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                {data?.latencyTrend && data.latencyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={data.latencyTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 9 }} stroke="#9ca3af" />
                      <Tooltip contentStyle={{ fontSize: "10px", borderRadius: "6px" }} />
                      <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2} dot={false} name="平均" />
                      <Line type="monotone" dataKey="p99" stroke="#ef4444" strokeWidth={2} dot={false} name="P99" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart hint={chartHint} />
                )}
              </div>
              <div>
                {data?.latencyDistribution && data.latencyDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={data.latencyDistribution} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="range" type="category" tick={{ fontSize: 9 }} width={50} />
                      <Tooltip contentStyle={{ fontSize: "10px" }} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart hint={chartHint} />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-0 shadow-sm">
          <CardContent className="pt-3 pb-2">
            <div className="mb-2 flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-semibold">模型排行</span>
            </div>
            {data?.modelUsage && data.modelUsage.length > 0 ? (
              <div className="max-h-[160px] space-y-2 overflow-y-auto pr-1">
                {data.modelUsage.slice(0, 10).map((m, i) => (
                  <div key={m.modelId} className="flex items-center gap-2">
                    <span className="w-4 text-center text-[10px] font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-1">
                        <span className="truncate text-[11px] font-medium">
                          {m.modelName || m.modelId}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {m.requests}次
                        </span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full rounded-full bg-slate-100">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${Math.min((m.requests / (data.modelUsage[0]?.requests || 1)) * 100, 100)}%`,
                            backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyChart hint={chartHint} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 grid-cols-2">
        <Card className="rounded-xl border-0 shadow-sm">
          <CardContent className="pt-3 pb-2">
            <div className="mb-2 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-pink-500" />
              <span className="text-sm font-semibold">服务商请求占比</span>
            </div>
            {data?.providerDistribution && data.providerDistribution.length > 0 ? (
              <div className="flex items-center">
                <ResponsiveContainer width="55%" height={140}>
                  <RePieChart>
                    <Pie
                      data={data.providerDistribution}
                      dataKey="requests"
                      nameKey="providerName"
                      cx="50%"
                      cy="50%"
                      outerRadius={50}
                    >
                      {data.providerDistribution.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: "10px" }} />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1">
                  {data.providerDistribution.slice(0, 6).map((p, i) => {
                    const total = data.providerDistribution.reduce(
                      (a, b) => a + b.requests,
                      0
                    );
                    return (
                      <div key={p.providerSlug} className="flex items-center gap-1.5 text-[10px]">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <span className="flex-1 truncate">{p.providerName}</span>
                        <span className="text-muted-foreground">
                          {total > 0 ? ((p.requests / total) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyChart hint={chartHint} />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-0 shadow-sm">
          <CardContent className="pt-3 pb-2">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold">错误分布</span>
              <Badge variant="destructive" className="ml-auto text-[9px]">
                {data?.errorDistribution?.reduce((a, b) => a + b.count, 0) ?? 0}
              </Badge>
            </div>
            {data?.errorDistribution && data.errorDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={data.errorDistribution.slice(0, 6)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="errorMessage"
                    tick={{ fontSize: 8 }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ fontSize: "10px" }} />
                  <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart hint={hasUsage ? "暂无错误" : chartHint} />
            )}
          </CardContent>
        </Card>
      </div>

      {data?.recentErrors && data.recentErrors.length > 0 && (
        <Card className="rounded-xl border-0 border-l-4 border-l-red-500 shadow-sm">
          <CardContent className="pt-3 pb-3">
            <div className="mb-3 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-semibold">最近错误</span>
              <Badge variant="destructive" className="text-[9px]">
                {data.recentErrors.length} 条
              </Badge>
              <Link
                href="/dashboard/records?status=error"
                className="ml-auto text-xs text-blue-600 hover:underline"
              >
                查看全部失败记录
              </Link>
            </div>
            <div className="max-h-[200px] space-y-2 overflow-y-auto pr-1">
              {data.recentErrors.slice(0, 15).map((err) => (
                <div
                  key={err.id}
                  className="rounded-lg border border-red-100 bg-red-50/50 p-2 dark:border-red-900 dark:bg-red-950/30"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-red-200 text-[9px] text-red-700">
                      {err.providerName}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {err.modelName}
                    </span>
                    <span className="ml-auto text-[9px] text-muted-foreground">
                      {new Date(err.createdAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-red-700" title={err.errorMessage}>
                    {err.errorMessage}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
