"use client";

import { useEffect, useState, useCallback } from "react";
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
  KeySquare,
  Users,
  BarChart3,
  UserPlus,
  Coins,
  Database,
  Zap,
  Timer,
} from "lucide-react";


interface DashboardData {
  cards: {
    apiKeys: { total: number; active: number };
    accounts: { total: number; active: number };
    todayRequests: { count: number; total: number };
    users: { active: number; total: number };
    todayTokens: { count: number; cost: string; totalCost: string };
    totalTokens: { count: number; cost: string };
    performance: { rpm: number; tpm: number };
    avgLatency: { ms: number; activeUsers: number };
  };

  topUsers: {
    keyId: number;
    keyName: string;
    requests: number;
    tokens: number;
  }[];
  recentLogs: {
    id: number;
    modelId: string;
    modelName: string;
    providerName: string;
    totalTokens: number;
    latencyMs: number;
    status: string;
    createdAt: string;
  }[];
}

type TimeRange = "24h" | "7d" | "30d";
type Granularity = "hour" | "day";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("24h");
  const [granularity, setGranularity] = useState<Granularity>("hour");


  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/usage/dashboard?range=${range}&granularity=${granularity}`
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [range, granularity]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const cards = data?.cards;

  return (
    <div className="space-y-6">
      {/* 顶部统计卡片 - 第一行 */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<KeySquare className="h-5 w-5 text-blue-500" />}
          iconBg="bg-blue-50"
          label="API 密钥"
          value={cards?.apiKeys.total ?? 0}
          sub={
            <span className="text-blue-500">
              {cards?.apiKeys.active ?? 0} 启用
            </span>
          }
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-indigo-500" />}
          iconBg="bg-indigo-50"
          label="账号"
          value={cards?.accounts.total ?? 0}
          sub={
            <span className="text-indigo-500">
              {cards?.accounts.active ?? 0} 启用
            </span>
          }
        />
        <StatCard
          icon={<BarChart3 className="h-5 w-5 text-amber-500" />}
          iconBg="bg-amber-50"
          label="今日请求"
          value={cards?.todayRequests.count ?? 0}
          sub={
            <span className="text-muted-foreground">
              总计: {cards?.todayRequests.total?.toLocaleString() ?? 0}
            </span>
          }
        />
        <StatCard
          icon={<UserPlus className="h-5 w-5 text-green-500" />}
          iconBg="bg-green-50"
          label="用户"
          value={`+${cards?.users.active ?? 0}`}
          sub={
            <span className="text-muted-foreground">
              总计: {cards?.users.total ?? 0}
            </span>
          }
        />
      </div>

      {/* 顶部统计卡片 - 第二行 */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Coins className="h-5 w-5 text-rose-500" />}
          iconBg="bg-rose-50"
          label="今日 Token"
          value={formatTokenCount(cards?.todayTokens.count ?? 0)}
          sub={
            <span className="text-rose-500">
              ${cards?.todayTokens.cost ?? "0.0000"} / $
              {cards?.todayTokens.totalCost ?? "0.0000"}
            </span>
          }
        />
        <StatCard
          icon={<Database className="h-5 w-5 text-indigo-500" />}
          iconBg="bg-indigo-50"
          label="总 Token"
          value={formatTokenCount(cards?.totalTokens.count ?? 0)}
          sub={
            <span className="text-indigo-500">
              ${cards?.totalTokens.cost ?? "0.0000"} / $
              {cards?.totalTokens.cost ?? "0.0000"}
            </span>
          }
        />
        <StatCard
          icon={<Zap className="h-5 w-5 text-cyan-500" />}
          iconBg="bg-cyan-50"
          label="性能指标"
          value={`${cards?.performance.rpm ?? 0}`}
          valueUnit="RPM"
          sub={
            <span className="text-muted-foreground">
              {cards?.performance.tpm ?? 0} TPM
            </span>
          }
        />
        <StatCard
          icon={<Timer className="h-5 w-5 text-red-500" />}
          iconBg="bg-red-50"
          label="平均响应"
          value={`${cards?.avgLatency.ms ?? 0}ms`}
          sub={
            <span className="text-muted-foreground">
              {cards?.avgLatency.activeUsers ?? 0} 活跃用户
            </span>
          }
        />
      </div>

      {/* 筛选条件 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">时间范围:</span>
          <Select
            value={range}
            onValueChange={(v) => setRange(v as TimeRange)}
          >
            <SelectTrigger className="w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">近 24 小时</SelectItem>
              <SelectItem value="7d">近 7 天</SelectItem>
              <SelectItem value="30d">近 30 天</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">粒度:</span>
          <Select
            value={granularity}
            onValueChange={(v) => setGranularity(v as Granularity)}
          >
            <SelectTrigger className="w-28 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hour">按小时</SelectItem>
              <SelectItem value="day">按天</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 用户消费榜 */}
      <Card className="rounded-xl border-0 shadow-sm">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-base mb-4">用户消费榜</h3>
          {data?.topUsers && data.topUsers.length > 0 ? (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {data.topUsers.map((u, i) => (
                <div
                  key={u.keyId ?? i}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="font-medium">{u.keyName || `Key #${u.keyId}`}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="text-xs">{u.tokens.toLocaleString()} tokens</span>
                    <Badge variant="secondary" className="text-xs">{u.requests} 次</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </CardContent>
      </Card>

      {/* 最近使用 */}
      <Card className="rounded-xl border-0 shadow-sm">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-base mb-4">最近使用 (Top 12)</h3>
          {data?.recentLogs && data.recentLogs.length > 0 ? (
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {data.recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {log.modelName || log.modelId}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {log.providerName} ·{" "}
                      {new Date(log.createdAt).toLocaleString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {log.totalTokens} tokens
                    </span>
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        log.status === "success"
                          ? "bg-emerald-500"
                          : "bg-red-500"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  label,
  value,
  valueUnit,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string | number;
  valueUnit?: string;
  sub: React.ReactNode;
}) {
  return (
    <Card className="rounded-xl border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold leading-none">
              {typeof value === "number" ? value.toLocaleString() : value}
              {valueUnit && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  {valueUnit}
                </span>
              )}
            </p>
            <p className="text-xs mt-1">{sub}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-[260px] text-muted-foreground">
      <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
        <Database className="h-8 w-8 text-slate-300" />
      </div>
      <p className="text-sm">暂无数据</p>
    </div>
  );
}

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}
