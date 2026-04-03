"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Key, Zap, Database } from "lucide-react";
import { RequestChart } from "@/components/charts/request-chart";
import { ProviderPieChart } from "@/components/charts/provider-pie-chart";
import { RecentLogs } from "@/components/dashboard/recent-logs";

interface DashboardStats {
  todayRequests: number;
  totalTokens: number;
  activeKeys: number;
  activeProviders: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    todayRequests: 0,
    totalTokens: 0,
    activeKeys: 0,
    activeProviders: 0,
  });

  useEffect(() => {
    fetch("/api/admin/usage?summary=true")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">控制台</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日请求</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.todayRequests.toLocaleString()}
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
              {stats.totalTokens.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃密钥</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeKeys}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃服务商</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeProviders}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>请求趋势 (7天)</CardTitle>
          </CardHeader>
          <CardContent>
            <RequestChart />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>服务商用量分布</CardTitle>
          </CardHeader>
          <CardContent>
            <ProviderPieChart />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>最近请求</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentLogs />
        </CardContent>
      </Card>
    </div>
  );
}
