"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
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
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Monitor,
  CheckCircle2,
} from "lucide-react";

interface RecordsData {
  summary: {
    totalRequests: number;
    totalTokens: number;
    avgLatency: number;
    promptTokens: number;
    completionTokens: number;
    errors: number;
    successRate: number;
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

const RANGE_LABELS: Record<TimeRange, string> = {
  "1h": "近 1 小时",
  "6h": "近 6 小时",
  "24h": "近 24 小时",
  "7d": "近 7 天",
  "30d": "近 30 天",
};

function RecordsPageContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<RecordsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("24h");
  const [page, setPage] = useState(1);

  const [filterModel, setFilterModel] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterKeyName, setFilterKeyName] = useState("");

  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success" || status === "error") {
      setFilterStatus(status);
    }
  }, [searchParams]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        range,
        page: String(page),
        pageSize: "20",
      });
      if (filterModel.trim()) params.set("model", filterModel.trim());
      if (filterProvider.trim()) params.set("provider", filterProvider.trim());
      if (filterStatus) params.set("status", filterStatus);
      if (filterKeyName.trim()) params.set("keyName", filterKeyName.trim());

      const res = await fetch(`/api/admin/usage/records?${params}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [range, page, filterModel, filterProvider, filterStatus, filterKeyName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function exportCSV() {
    if (!data?.logs?.length) return;
    const headers = [
      "ID",
      "API密钥",
      "服务商",
      "模型",
      "输入Token",
      "输出Token",
      "合计Token",
      "耗时(ms)",
      "状态",
      "错误信息",
      "时间",
    ];
    const rows = data.logs.map((l) => [
      l.id,
      l.apiKeyName || "-",
      l.providerName || "-",
      l.modelName || l.modelId,
      l.promptTokens,
      l.completionTokens,
      l.totalTokens,
      l.latencyMs ?? "",
      l.status,
      (l.errorMessage || "").replace(/,/g, " "),
      new Date(l.createdAt).toLocaleString("zh-CN"),
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n"
    );
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usage-logs-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetFilters() {
    setFilterModel("");
    setFilterProvider("");
    setFilterStatus("");
    setFilterKeyName("");
    setPage(1);
  }

  const summary = data?.summary;
  const pagination = data?.pagination;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">使用记录</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            分页查看每次 API 调用明细，支持筛选与导出。趋势与延迟分析请见
            <Link
              href="/dashboard/monitoring"
              className="mx-1 inline-flex items-center gap-0.5 text-blue-600 hover:underline"
            >
              运维监控
              <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={range}
            onValueChange={(v) => {
              setRange(v as TimeRange);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-32">
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
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={exportCSV}
            disabled={!data?.logs?.length}
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            导出 CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat
          icon={<Activity className="h-4 w-4 text-blue-500" />}
          label="请求数"
          value={loading ? "—" : String(summary?.totalRequests ?? 0)}
        />
        <MiniStat
          icon={<Database className="h-4 w-4 text-violet-500" />}
          label="Token"
          value={
            loading ? "—" : formatTokens(summary?.totalTokens ?? 0)
          }
          sub={
            loading
              ? undefined
              : `入 ${formatTokens(summary?.promptTokens ?? 0)} / 出 ${formatTokens(summary?.completionTokens ?? 0)}`
          }
        />
        <MiniStat
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          label="成功率"
          value={loading ? "—" : `${summary?.successRate ?? 100}%`}
          sub={loading ? undefined : `${summary?.errors ?? 0} 次失败`}
        />
        <MiniStat
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          label="平均耗时"
          value={loading ? "—" : `${summary?.avgLatency ?? 0} ms`}
        />
      </div>

      <Card className="rounded-xl border-0 shadow-sm">
        <CardContent className="py-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
            <FilterField label="API 密钥">
              <Input
                placeholder="按名称搜索"
                value={filterKeyName}
                onChange={(e) => setFilterKeyName(e.target.value)}
                className="h-9"
              />
            </FilterField>
            <FilterField label="模型">
              <Input
                placeholder="模型 ID 片段"
                value={filterModel}
                onChange={(e) => setFilterModel(e.target.value)}
                className="h-9"
              />
            </FilterField>
            <FilterField label="服务商">
              <Input
                placeholder="服务商名称"
                value={filterProvider}
                onChange={(e) => setFilterProvider(e.target.value)}
                className="h-9"
              />
            </FilterField>
            <FilterField label="状态">
              <Select
                value={filterStatus || "all"}
                onValueChange={(v) => {
                  setFilterStatus(!v || v === "all" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="success">成功</SelectItem>
                  <SelectItem value="error">失败</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <div className="flex items-end gap-2">
              <Button
                className="h-9 flex-1"
                onClick={() => {
                  setPage(1);
                  fetchData();
                }}
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                查询
              </Button>
              <Button variant="outline" className="h-9" onClick={resetFilters}>
                重置
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
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
                      <TableHead className="text-xs">时间</TableHead>
                      <TableHead className="text-xs">API 密钥</TableHead>
                      <TableHead className="text-xs">服务商</TableHead>
                      <TableHead className="text-xs">模型</TableHead>
                      <TableHead className="text-xs">状态</TableHead>
                      <TableHead className="text-right text-xs">Token</TableHead>
                      <TableHead className="text-right text-xs">耗时</TableHead>
                      <TableHead className="text-xs">错误信息</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.logs?.length ? (
                      data.logs.map((log) => (
                        <TableRow key={log.id} className="text-sm">
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {new Date(log.createdAt).toLocaleString("zh-CN")}
                          </TableCell>
                          <TableCell className="max-w-[100px] truncate">
                            {log.apiKeyName || (log.apiKeyId ? `#${log.apiKeyId}` : "—")}
                          </TableCell>
                          <TableCell className="max-w-[90px] truncate">
                            {log.providerName || "—"}
                          </TableCell>
                          <TableCell className="max-w-[130px] truncate font-mono text-xs">
                            {log.modelName || log.modelId}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                log.status === "success" ? "default" : "destructive"
                              }
                              className="text-xs"
                            >
                              {log.status === "success" ? "成功" : "失败"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            <span title={`入 ${log.promptTokens} / 出 ${log.completionTokens}`}>
                              {log.totalTokens.toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {log.latencyMs != null ? `${log.latencyMs} ms` : "—"}
                          </TableCell>
                          <TableCell
                            className="max-w-[200px] truncate text-xs text-red-600"
                            title={log.errorMessage || undefined}
                          >
                            {log.status === "error" ? log.errorMessage || "—" : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="py-14 text-center text-muted-foreground"
                        >
                          <p>当前筛选条件下暂无记录</p>
                          <p className="mt-2 text-xs">
                            调用{" "}
                            <code className="rounded bg-slate-100 px-1">
                              /v1/chat/completions
                            </code>{" "}
                            后会出现明细；图表分析请打开
                            <Link
                              href="/dashboard/monitoring"
                              className="text-blue-600 hover:underline"
                            >
                              运维监控
                            </Link>
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    共 {pagination.total} 条 · 第 {pagination.page} /{" "}
                    {pagination.totalPages} 页
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
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

      <Card className="border-blue-100 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="flex items-start gap-3 py-3 text-sm">
          <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">运维监控</span>
            提供请求趋势、延迟 P50/P99、模型排行、服务商状态与机器资源；本页专注
            <span className="font-medium text-foreground">长周期（最长 30 天）</span>
            的逐条日志与 CSV 导出。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RecordsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
      }
    >
      <RecordsPageContent />
    </Suspense>
  );
}

function MiniStat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card className="rounded-xl border-0 shadow-sm">
      <CardContent className="flex items-start gap-3 py-4">
        <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tabular-nums">{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}
