"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  Database,
  Clock,
  AlertTriangle,
  Download,
} from "lucide-react";

interface UsageSummary {
  total_requests: number;
  total_tokens: number;
  avg_latency_ms: number;
  error_rate: number;
}

interface ModelUsage {
  model: string;
  provider: string;
  requests: number;
  tokens: number;
  avg_latency_ms: number;
  errors: number;
}

type DateRange = "7d" | "30d" | "custom";

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDate(d);
}

export default function UsagePage() {
  const [range, setRange] = useState<DateRange>("7d");
  const [customFrom, setCustomFrom] = useState(daysAgo(7));
  const [customTo, setCustomTo] = useState(formatDate(new Date()));
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [usage, setUsage] = useState<ModelUsage[]>([]);
  const [loading, setLoading] = useState(true);

  const getDateParams = useCallback(() => {
    switch (range) {
      case "7d":
        return `from=${daysAgo(7)}&to=${formatDate(new Date())}`;
      case "30d":
        return `from=${daysAgo(30)}&to=${formatDate(new Date())}`;
      case "custom":
        return `from=${customFrom}&to=${customTo}`;
    }
  }, [range, customFrom, customTo]);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    try {
      const params = getDateParams();
      const [summaryRes, usageRes] = await Promise.all([
        fetch(`/api/admin/usage?summary=true&${params}`),
        fetch(`/api/admin/usage?by_model=true&${params}`),
      ]);
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data);
      }
      if (usageRes.ok) {
        const data = await usageRes.json();
        setUsage(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [getDateParams]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  function exportCSV() {
    if (usage.length === 0) return;
    const headers = ["模型", "服务商", "请求数", "Token 用量", "平均延迟 (ms)", "错误数"];
    const rows = usage.map((u) => [
      u.model,
      u.provider,
      u.requests,
      u.tokens,
      u.avg_latency_ms,
      u.errors,
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `usage-${range === "custom" ? `${customFrom}-${customTo}` : range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">用量统计</h1>
        <Button variant="outline" onClick={exportCSV} disabled={usage.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          导出 CSV
        </Button>
      </div>

      {/* Date range controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-2">
              <Label>时间范围</Label>
              <Select
                value={range}
                onValueChange={(val: string | null) => setRange((val || "7d") as DateRange)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">近 7 天</SelectItem>
                  <SelectItem value="30d">近 30 天</SelectItem>
                  <SelectItem value="custom">自定义</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {range === "custom" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="u-from">开始日期</Label>
                  <Input
                    id="u-from"
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="u-to">结束日期</Label>
                  <Input
                    id="u-to"
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </div>
                <Button onClick={fetchUsage}>查询</Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总请求数</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(summary?.total_requests ?? 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总 Token 用量</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(summary?.total_tokens ?? 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均延迟</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(summary?.avg_latency_ms ?? 0).toFixed(0)} ms
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">错误率</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {((summary?.error_rate ?? 0) * 100).toFixed(2)}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Usage by model */}
      <Card>
        <CardHeader>
          <CardTitle>按模型统计</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>模型</TableHead>
                  <TableHead>服务商</TableHead>
                  <TableHead>请求数</TableHead>
                  <TableHead>Token 用量</TableHead>
                  <TableHead>平均延迟</TableHead>
                  <TableHead>错误</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      该时间段暂无用量数据
                    </TableCell>
                  </TableRow>
                ) : (
                  usage.map((u, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{u.model}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{u.provider}</Badge>
                      </TableCell>
                      <TableCell>{u.requests.toLocaleString()}</TableCell>
                      <TableCell>{u.tokens.toLocaleString()}</TableCell>
                      <TableCell>{u.avg_latency_ms.toFixed(0)} ms</TableCell>
                      <TableCell>
                        {u.errors > 0 ? (
                          <span className="text-red-600">{u.errors.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
