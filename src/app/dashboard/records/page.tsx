"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  Database,
  Clock,
  DollarSign,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const PIE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

interface RecordsData {
  summary: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    avgLatency: number;
    promptTokens: number;
    completionTokens: number;
  };
  charts: {
    modelDistribution: {
      modelId: string;
      modelName: string;
      requests: number;
      tokens: number;
      cost: number;
    }[];
    providerDistribution: {
      providerId: number;
      providerName: string;
      requests: number;
      tokens: number;
      cost: number;
    }[];
    tokenTrend: {
      time: string;
      tokens: number;
      requests: number;
      cost: number;
    }[];
  };
  logs: {
    id: number;
    apiKeyId: number | null;
    apiKeyName: string | null;
    modelId: string;
    modelName: string | null;
    providerId: number | null;
    providerName: string | null;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number | null;
    status: string;
    errorMessage: string | null;
    createdAt: string;
  }[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d";
type Granularity = "minute" | "hour" | "day";
type ChartTab = "requests" | "tokens" | "cost";
type DistTab = "tokens" | "cost";

export default function RecordsPage() {
  const [data, setData] = useState<RecordsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("24h");
  const [granularity, setGranularity] = useState<Granularity>("hour");
  const [page, setPage] = useState(1);
  const [modelChartTab, setModelChartTab] = useState<ChartTab>("requests");
  const [distTab, setDistTab] = useState<DistTab>("tokens");

  // 筛选
  const [filterModel, setFilterModel] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterKeyName, setFilterKeyName] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        range,
        granularity,
        page: String(page),
        pageSize: "20",
      });
      if (filterModel) params.set("model", filterModel);
      if (filterProvider) params.set("provider", filterProvider);
      if (filterStatus) params.set("status", filterStatus);

      const res = await fetch(`/api/admin/usage/records?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [range, granularity, page, filterModel, filterProvider, filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 导出 CSV
  function exportCSV() {
    if (!data?.logs?.length) return;
    const headers = ["ID", "API密钥", "模型", "服务商", "Prompt Tokens", "Completion Tokens", "Total Tokens", "费用($)", "耗时(ms)", "状态", "时间"];
    const rows = data.logs.map((l) => [
      l.id,
      l.apiKeyName || "-",
      l.modelName || l.modelId,
      l.providerName || "-",
      l.promptTokens,
      l.completionTokens,
      l.totalTokens,
      (l.totalTokens / 1000 * 0.01).toFixed(4),
      l.latencyMs || 0,
      l.status,
      new Date(l.createdAt).toLocaleString("zh-CN"),
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usage-records-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const summary = data?.summary;
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-2xl font-bold">使用记录</h1>
        <p className="text-sm text-muted-foreground">查看和管理所有用户的使用记录</p>
      </div>

      {/* 汇总卡片 */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<Activity className="h-5 w-5 text-blue-500" />}
          iconBg="bg-blue-50"
          label="总请求数"
          value={loading ? "-" : (summary?.totalRequests ?? 0).toLocaleString()}
          sub="所选范围内"
        />
        <SummaryCard
          icon={<Database className="h-5 w-5 text-amber-500" />}
          iconBg="bg-amber-50"
          label="总 Token"
          value={loading ? "-" : (summary?.totalTokens ?? 0).toLocaleString()}
          sub={loading ? "" : `输入: ${(summary?.promptTokens ?? 0).toLocaleString()} / 输出: ${(summary?.completionTokens ?? 0).toLocaleString()}`}
        />
        <SummaryCard
          icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
          iconBg="bg-emerald-50"
          label="总消费"
          value={loading ? "-" : `$${(summary?.totalCost ?? 0).toFixed(4)}`}
          sub={loading ? "" : `折合 $${(summary?.totalCost ?? 0).toFixed(4)}`}
          valueColor="text-emerald-600"
        />
        <SummaryCard
          icon={<Clock className="h-5 w-5 text-purple-500" />}
          iconBg="bg-purple-50"
          label="平均耗时"
          value={loading ? "-" : `${summary?.avgLatency ?? 0}ms`}
        />
      </div>

      {/* 时间范围 + 粒度 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">时间范围:</span>
          <Select value={range} onValueChange={(v) => { setRange(v as TimeRange); setPage(1); }}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">近 1 小时</SelectItem>
              <SelectItem value="6h">近 6 小时</SelectItem>
              <SelectItem value="24h">近 24 小时</SelectItem>
              <SelectItem value="7d">近 7 天</SelectItem>
              <SelectItem value="30d">近 30 天</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">粒度:</span>
          <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
            <SelectTrigger className="w-28 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minute">按分钟</SelectItem>
              <SelectItem value="hour">按小时</SelectItem>
              <SelectItem value="day">按天</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* 模型分布 */}
        <Card className="rounded-xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">模型分布</CardTitle>
              <div className="flex gap-1">
                {(["requests", "tokens", "cost"] as ChartTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setModelChartTab(tab)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      modelChartTab === tab
                        ? "bg-slate-900 text-white"
                        : "text-muted-foreground hover:bg-slate-100"
                    }`}
                  >
                    {tab === "requests" ? "请求" : tab === "tokens" ? "按 Token" : "按实际消费"}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {data?.charts?.modelDistribution?.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={data.charts.modelDistribution}
                    dataKey={modelChartTab}
                    nameKey="modelName"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (entry: any) => entry.modelName || entry.modelId
                    }
                  >
                    {data.charts.modelDistribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>

        {/* 分组使用分布 (Provider) */}
        <Card className="rounded-xl border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">分组使用分布</CardTitle>
              <div className="flex gap-1">
                {(["tokens", "cost"] as DistTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDistTab(tab)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      distTab === tab
                        ? "bg-slate-900 text-white"
                        : "text-muted-foreground hover:bg-slate-100"
                    }`}
                  >
                    {tab === "tokens" ? "按 Token" : "按实际消费"}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {data?.charts?.providerDistribution?.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={data.charts.providerDistribution}
                    dataKey={distTab}
                    nameKey="providerName"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (entry: any) => entry.providerName || "Unknown"
                    }
                  >
                    {data.charts.providerDistribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Token 使用趋势 */}
      <Card className="rounded-xl border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Token 使用趋势</CardTitle>
        </CardHeader>
        <CardContent>
            {data?.charts?.tokenTrend?.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.charts.tokenTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  />
                  <Bar dataKey="tokens" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} name="Token" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart />
            )}
          </CardContent>
        </Card>

      {/* 筛选栏 */}
      <Card className="rounded-xl border-0 shadow-sm">
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">API 密钥</label>
              <Input
                placeholder="按名称搜索 API 密钥..."
                value={filterKeyName}
                onChange={(e) => setFilterKeyName(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">模型</label>
              <Input
                placeholder="请输入模型ID"
                value={filterModel}
                onChange={(e) => setFilterModel(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">账户</label>
              <Input
                placeholder="按名称搜索账号..."
                value={filterProvider}
                onChange={(e) => setFilterProvider(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">类型</label>
              <Select value={filterStatus} onValueChange={(v: string | null) => { setFilterStatus(!v || v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="请选择" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="success">成功</SelectItem>
                  <SelectItem value="error">失败</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => { setPage(1); fetchData(); }} variant="outline" size="sm" className="h-9">
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> 刷新
              </Button>
              <Button
                onClick={() => {
                  setFilterModel("");
                  setFilterProvider("");
                  setFilterStatus("");
                  setFilterKeyName("");
                  setPage(1);
                }}
                variant="outline"
                size="sm"
                className="h-9"
              >
                重置
              </Button>
            </div>
            <div className="flex items-end">
              <Button onClick={exportCSV} variant="default" size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700">
                <Download className="h-3.5 w-3.5 mr-1" /> 导出 Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <Card className="rounded-xl border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs">API 密钥</TableHead>
                      <TableHead className="text-xs">账户</TableHead>
                      <TableHead className="text-xs">模型</TableHead>
                      <TableHead className="text-xs">类型</TableHead>
                      <TableHead className="text-xs text-right">TOKEN</TableHead>
                      <TableHead className="text-xs text-right">费用</TableHead>
                      <TableHead className="text-xs text-right">首 TOKEN</TableHead>
                      <TableHead className="text-xs text-right">耗时</TableHead>
                      <TableHead className="text-xs">时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.logs?.length ? (
                      data.logs.map((log) => (
                        <TableRow key={log.id} className="text-sm">
                          <TableCell className="max-w-[120px] truncate">
                            {log.apiKeyName || (log.apiKeyId ? `Key#${log.apiKeyId}` : "-")}
                          </TableCell>
                          <TableCell className="max-w-[100px] truncate">
                            {log.providerName || "-"}
                          </TableCell>
                          <TableCell className="max-w-[140px] truncate font-mono text-xs">
                            {log.modelName || log.modelId}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={log.status === "success" ? "default" : "destructive"}
                              className="text-xs"
                            >
                              {log.status === "success" ? "成功" : "失败"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {log.totalTokens.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            ${(log.totalTokens / 1000 * 0.01).toFixed(4)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {log.promptTokens.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {log.latencyMs ? `${log.latencyMs}ms` : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString("zh-CN", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                          暂无数据
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* 分页 */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    共 {pagination.total} 条记录，第 {pagination.page} / {pagination.totalPages} 页
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                      let pageNum: number;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(pageNum)}
                          className="w-9"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pagination.totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon,
  iconBg,
  label,
  value,
  sub,
  valueColor,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <Card className="rounded-xl border-0 shadow-sm">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-lg ${iconBg}`}>{icon}</div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${valueColor || ""}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center h-[260px] text-muted-foreground">
      <p className="text-sm">暂无数据</p>
    </div>
  );
}
