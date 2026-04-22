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
// import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  AlertTriangle,
  Clock,
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  Server,
  Timer,
  Wifi,
  RefreshCw,
  TrendingUp,
  ShieldAlert,
  BarChart3,
  Globe,
  Database as DatabaseIcon,
  Zap,
  ArrowUp,
  ArrowDown,
  Target,
  Gauge,
  Users,
  Layers,
  Coins,
  AlertCircle,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Hash,
  PieChart,
  LineChart as LineChartIcon,
  Activity as ActivityIcon,
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Legend,
} from "recharts";

interface MonitoringData {
  realtime: {
    status: string;
    qps: number;
    tps: number;
    requests: number;
    tokens: number;
    errors: number;
    successRate: number;
    activeConnections: number;
    avgResponseTime: number;
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
    cost: number;
  }[];
  modelUsage: {
    modelId: string;
    modelName: string;
    requests: number;
    tokens: number;
    providerName: string;
  }[];
  requestTrend: { time: string; requests: number; tokens: number; errors: number }[];
  tokenTrend: { time: string; inputTokens: number; outputTokens: number; cost: number }[];
  latencyTrend: { time: string; p50: number; p99: number; avg: number }[];
  errorTrend: { time: string; errors: number; total: number }[];
  errorDistribution: { errorMessage: string; count: number; percent: number }[];
  recentErrors: {
    id: number;
    modelId: string;
    modelName: string;
    providerName: string;
    errorMessage: string;
    latencyMs: number;
    createdAt: string;
    requestPath?: string;
    statusCode?: number;
  }[];
  providerHealth: {
    id: number;
    name: string;
    slug: string;
    status: string;
    responseTime: number;
  }[];
}

type TimeRange = "1min" | "5min" | "30min" | "1h" | "6h" | "24h";

interface SystemMetrics {
  hostname: string;
  platform: string;
  cpu: { percent: number; cores: number };
  memory: { percent: number; usedGB: string; totalGB: string };
  disk: { percent: number; usedGB: string; totalGB: string };
  load: { load1: number; load5: number; load15: number; cores: number };
  network: { 
    rxSpeed: number; 
    txSpeed: number; 
    rxSpeedMB: string;
    txSpeedMB: string;
    totalRxGB: string;
    totalTxGB: string;
  };
  redis: {
    version: string;
    memoryPercent: number;
    memoryUsed: string;
    memoryMax: string;
    opsPerSec: number;
    hitRate: number;
    dbKeys: number;
    connectedClients: number;
  };
  database: { status: string; size: string; connections: number };
  uptime: { days: number; hours: number; minutes: number };
  processes: { total: number; running: number };
}

// 圆环仪表盘
function CircularGauge({
  value,
  max = 100,
  label,
  subLabel,
  color,
  size = 75,
  strokeWidth = 6,
  icon,
  showPercent = true,
  valueFormatter,
}: {
  value: number;
  max?: number;
  label: string;
  subLabel?: string;
  color: string;
  size?: number;
  strokeWidth?: number;
  icon?: React.ReactNode;
  showPercent?: boolean;
  valueFormatter?: (v: number) => string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(Math.max(value, 0), max);
  const strokeDashoffset = circumference - (percentage / max) * circumference;

  const getColor = () => {
    if (percentage >= 90) return "#ef4444";
    if (percentage >= 70) return "#f59e0b";
    return color;
  };

  const barColor = getColor();
  const displayValue = valueFormatter ? valueFormatter(percentage) : Math.round(percentage).toString();

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
          <circle
            cx={size/2} cy={size/2} r={radius}
            fill="none" stroke={barColor} strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {icon ? (
            <div style={{ color: barColor }}>{icon}</div>
          ) : (
            <span className="text-sm font-bold" style={{ color: barColor }}>
              {displayValue}{showPercent && <span className="text-[7px]">%</span>}
            </span>
          )}
        </div>
      </div>
      <div className="mt-1 text-center">
        <p className="text-[10px] font-semibold leading-tight">{label}</p>
        {subLabel && <p className="text-[8px] text-muted-foreground leading-tight">{subLabel}</p>}
      </div>
    </div>
  );
}

// 网络仪表盘
function NetworkGauge({ rxSpeed, txSpeed, rxSpeedMB, txSpeedMB, size = 80 }: {
  rxSpeed: number; txSpeed: number; rxSpeedMB: string; txSpeedMB: string; size?: number;
}) {
  const center = size / 2;
  const strokeWidth = 5;
  const maxSpeed = 10 * 1024;
  const rxPercent = Math.min((rxSpeed / maxSpeed) * 100, 100);
  const txPercent = Math.min((txSpeed / maxSpeed) * 100, 100);
  const rRx = (size - strokeWidth) / 2 - 2;
  const rTx = rRx - strokeWidth - 2;
  const cRx = rRx * 2 * Math.PI;
  const cTx = rTx * 2 * Math.PI;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={center} cy={center} r={rRx} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
          <circle cx={center} cy={center} r={rTx} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
          <circle cx={center} cy={center} r={rRx} fill="none" stroke="#22c55e" strokeWidth={strokeWidth}
            strokeLinecap="round" strokeDasharray={cRx} strokeDashoffset={cRx - (rxPercent/100)*cRx}
            className="transition-all duration-500" />
          <circle cx={center} cy={center} r={rTx} fill="none" stroke="#3b82f6" strokeWidth={strokeWidth}
            strokeLinecap="round" strokeDasharray={cTx} strokeDashoffset={cTx - (txPercent/100)*cTx}
            className="transition-all duration-500" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center gap-0.5">
          <ArrowDown className="h-3 w-3 text-green-500" />
          <ArrowUp className="h-3 w-3 text-blue-500" />
        </div>
      </div>
      <div className="mt-1 text-center">
        <p className="text-[10px] font-semibold leading-tight">网络</p>
        <p className="text-[8px] text-muted-foreground leading-tight">
          <span className="text-green-600">↓{rxSpeedMB}</span> <span className="text-blue-600">↑{txSpeedMB}</span>
        </p>
      </div>
    </div>
  );
}

// 负载三合一圆环
function LoadGauge({ load1, load5, load15, cores, size = 80 }: {
  load1: number; load5: number; load15: number; cores: number; size?: number;
}) {
  const center = size / 2;
  const strokeWidth = 4;
  const maxLoad = cores * 2;
  const p1 = Math.min((load1 / maxLoad) * 100, 100);
  const p5 = Math.min((load5 / maxLoad) * 100, 100);
  const p15 = Math.min((load15 / maxLoad) * 100, 100);
  const r1 = (size - strokeWidth) / 2 - 2;
  const r5 = r1 - strokeWidth - 2;
  const r15 = r5 - strokeWidth - 2;
  const getColor = (p: number) => p >= 90 ? "#ef4444" : p >= 70 ? "#f59e0b" : "#3b82f6";

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {[r1, r5, r15].map((r, i) => (
            <circle key={i} cx={center} cy={center} r={r} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
          ))}
          <circle cx={center} cy={center} r={r1} fill="none" stroke={getColor(p1)} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeDasharray={r1*2*Math.PI} strokeDashoffset={r1*2*Math.PI - (p1/100)*r1*2*Math.PI}
            className="transition-all duration-500" />
          <circle cx={center} cy={center} r={r5} fill="none" stroke={getColor(p5)} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeDasharray={r5*2*Math.PI} strokeDashoffset={r5*2*Math.PI - (p5/100)*r5*2*Math.PI}
            className="transition-all duration-500" />
          <circle cx={center} cy={center} r={r15} fill="none" stroke={getColor(p15)} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeDasharray={r15*2*Math.PI} strokeDashoffset={r15*2*Math.PI - (p15/100)*r15*2*Math.PI}
            className="transition-all duration-500" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-bold text-blue-600">{load1.toFixed(1)}</span>
        </div>
      </div>
      <div className="mt-1 text-center">
        <p className="text-[10px] font-semibold leading-tight">负载</p>
        <p className="text-[8px] text-muted-foreground leading-tight">{load1.toFixed(1)}/{load5.toFixed(1)}/{load15.toFixed(1)}</p>
      </div>
    </div>
  );
}

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [sysMetrics, setSysMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("1h");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [monRes, sysRes] = await Promise.all([
        fetch(`/api/admin/monitoring?range=${range}`),
        fetch(`/api/admin/monitoring/system`),
      ]);
      if (monRes.ok) {
        const json = await monRes.json();
        setData(json);
      }
      if (sysRes.ok) {
        const json = await sysRes.json();
        setSysMetrics(json);
      }
      setLastUpdated(new Date());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex justify-between">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const rt = data?.realtime;
  const lat = data?.latency;
  const isSystemHealthy = sysMetrics && sysMetrics.cpu.percent < 90 && sysMetrics.memory.percent < 95;
  const systemStatus = isSystemHealthy ? "active" : "warning";

  // 图表配色
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">运维监控</h1>
          <div className="flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${systemStatus === "active" ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse"}`} />
            <span className="text-sm text-muted-foreground">{systemStatus === "active" ? "运行中" : "警告"}</span>
          </div>
          <span className="text-xs text-muted-foreground">{lastUpdated.toLocaleTimeString("zh-CN")}</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as TimeRange)}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["1min","5min","30min","1h","6h","24h"].map(r => (
                <SelectItem key={r} value={r}>
                  {r === "1min" ? "1分钟" : r === "5min" ? "5分钟" : r === "30min" ? "30分钟" : r === "1h" ? "1小时" : r === "6h" ? "6小时" : "24小时"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-2 rounded-lg border text-sm ${autoRefresh ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-white border-slate-200"}`}
          >
            <RefreshCw className={`h-4 w-4 ${autoRefresh ? "animate-spin" : ""}`} style={{ animationDuration: "3s" }} />
          </button>
        </div>
      </div>

      {/* 服务器信息 */}
      {sysMetrics && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" />{sysMetrics.hostname}</span>
          <span className="flex items-center gap-1"><Timer className="h-3.5 w-3.5" />{sysMetrics.uptime.days}天{sysMetrics.uptime.hours}时</span>
          <span className="flex items-center gap-1"><DatabaseIcon className="h-3.5 w-3.5" />{sysMetrics.database.status}</span>
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{sysMetrics.redis.connectedClients + sysMetrics.database.connections}连接</span>
          <span className="flex items-center gap-1"><ActivityIcon className="h-3.5 w-3.5" />{sysMetrics.processes.running}/{sysMetrics.processes.total}进程</span>
        </div>
      )}

      {/* 圆环仪表盘 - 10个 */}
      {sysMetrics && (
        <Card className="rounded-xl border-0 shadow-sm">
          <CardContent className="py-3 px-2">
            <div className="grid grid-cols-10 gap-1">
              <CircularGauge value={sysMetrics.cpu.percent} label="CPU" subLabel={`${sysMetrics.cpu.cores}核`} color="#3b82f6" icon={<Cpu className="h-4 w-4" />} />
              <CircularGauge value={sysMetrics.memory.percent} label="内存" subLabel={`${sysMetrics.memory.usedGB}GB`} color="#8b5cf6" icon={<MemoryStick className="h-4 w-4" />} />
              <CircularGauge value={sysMetrics.disk.percent} label="磁盘" subLabel={`${sysMetrics.disk.usedGB}GB`} color="#10b981" icon={<HardDrive className="h-4 w-4" />} />
              <LoadGauge load1={sysMetrics.load.load1} load5={sysMetrics.load.load5} load15={sysMetrics.load.load15} cores={sysMetrics.load.cores} />
              <CircularGauge value={sysMetrics.redis.memoryPercent} label="Redis" subLabel={`${sysMetrics.redis.opsPerSec}ops`} color="#f59e0b" icon={<DatabaseIcon className="h-4 w-4" />} />
              <NetworkGauge rxSpeed={sysMetrics.network.rxSpeed} txSpeed={sysMetrics.network.txSpeed} rxSpeedMB={sysMetrics.network.rxSpeedMB} txSpeedMB={sysMetrics.network.txSpeedMB} />
              <CircularGauge value={sysMetrics.redis.hitRate} label="缓存" subLabel={`${sysMetrics.redis.dbKeys}keys`} color="#22c55e" icon={<Target className="h-4 w-4" />} />
              <CircularGauge value={rt?.successRate ?? 100} label="成功率" subLabel={`${rt?.errors ?? 0}错误`} color="#14b8a6" icon={<CheckCircle2 className="h-4 w-4" />} />
              <CircularGauge value={Math.min((rt?.qps ?? 0) * 5, 100)} max={100} label="QPS" subLabel={`${Math.round((rt?.qps ?? 0))}/s`} color="#f97316" icon={<Gauge className="h-4 w-4" />} showPercent={false} valueFormatter={(v) => `${Math.round(v/5)}`} />
              <CircularGauge value={Math.min((rt?.activeConnections ?? 0) * 10, 100)} max={100} label="连接" subLabel={`${rt?.activeConnections ?? 0}在线`} color="#ec4899" icon={<Users className="h-4 w-4" />} showPercent={false} valueFormatter={(v) => `${Math.round(v/10)}`} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 图表区域 - 第一行 */}
      <div className="grid gap-3 grid-cols-3">
        {/* 综合趋势 - 混合图表 */}
        <Card className="rounded-xl border-0 shadow-sm col-span-2">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="font-semibold text-sm">综合趋势</span>
              <div className="flex gap-3 ml-auto text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"/>请求</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"/>Token</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"/>错误</span>
              </div>
            </div>
            {data?.requestTrend && data.requestTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={data.requestTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "8px" }} />
                  <Area yAxisId="left" type="monotone" dataKey="requests" stroke="#3b82f6" fill="#3b82f640" strokeWidth={2} />
                  <Area yAxisId="right" type="monotone" dataKey="tokens" stroke="#a855f7" fill="#a855f740" strokeWidth={2} />
                  <Line yAxisId="left" type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* Token消耗与成本 */}
        <Card className="rounded-xl border-0 shadow-sm">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-sm">Token消耗</span>
            </div>
            {data?.tokenTrend && data.tokenTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={data.tokenTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                  <Tooltip contentStyle={{ fontSize: "11px", borderRadius: "8px" }} />
                  <Area type="monotone" dataKey="inputTokens" stackId="1" stroke="#10b981" fill="#10b981" name="Input" />
                  <Area type="monotone" dataKey="outputTokens" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="Output" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>
      </div>

      {/* 图表区域 - 第二行 */}
      <div className="grid gap-3 grid-cols-3">
        {/* 延迟趋势 + 分布 */}
        <Card className="rounded-xl border-0 shadow-sm col-span-2">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-sm">延迟分析</span>
              <div className="flex gap-2 ml-auto">
                {["P50","P90","P99"].map((p, i) => (
                  <Badge key={p} variant="outline" className="text-[9px]">{p}:{lat?.[p.toLowerCase() as keyof typeof lat] ?? 0}ms</Badge>
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
                ) : <EmptyChart />}
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
                ) : <EmptyChart />}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 模型使用排行 */}
        <Card className="rounded-xl border-0 shadow-sm">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-4 w-4 text-indigo-500" />
              <span className="font-semibold text-sm">模型排行</span>
            </div>
            {data?.modelUsage && data.modelUsage.length > 0 ? (
              <div className="h-[160px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                <div className="space-y-2">
                  {data.modelUsage.slice(0, 10).map((m, i) => (
                    <div key={m.modelId} className="flex items-center gap-2">
                      <span className="text-[10px] font-bold w-4 text-center text-muted-foreground">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium truncate">{m.modelName || m.modelId}</span>
                          <span className="text-[10px] text-muted-foreground">{m.requests}次</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-0.5">
                          <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min((m.requests / (data.modelUsage[0]?.requests || 1)) * 100, 100)}%`, backgroundColor: colors[i % colors.length] }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyChart />}
          </CardContent>
        </Card>
      </div>

      {/* 图表区域 - 第三行 */}
      <div className="grid gap-3 grid-cols-3">
        {/* 服务商分布 - 饼图 */}
        <Card className="rounded-xl border-0 shadow-sm">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <PieChart className="h-4 w-4 text-pink-500" />
              <span className="font-semibold text-sm">服务商占比</span>
            </div>
            {data?.providerDistribution && data.providerDistribution.length > 0 ? (
              <div className="flex items-center">
                <ResponsiveContainer width="60%" height={140}>
                  <RePieChart>
                    <Pie data={data.providerDistribution} dataKey="requests" nameKey="providerName" cx="50%" cy="50%" outerRadius={50} label={false}>
                      {data.providerDistribution.map((_, i) => <Cell key={`cell-${i}`} fill={colors[i % colors.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: "10px" }} />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1">
                  {data.providerDistribution.slice(0, 5).map((p, i) => (
                    <div key={p.providerSlug} className="flex items-center gap-1.5 text-[10px]">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                      <span className="truncate flex-1">{p.providerName}</span>
                      <span className="text-muted-foreground">{((p.requests / data.providerDistribution.reduce((a, b) => a + b.requests, 0)) * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* 错误分布 */}
        <Card className="rounded-xl border-0 shadow-sm">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="font-semibold text-sm">错误分布</span>
              <Badge variant="destructive" className="text-[9px] ml-auto">{data?.errorDistribution?.reduce((a, b) => a + b.count, 0) || 0}</Badge>
            </div>
            {data?.errorDistribution && data.errorDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={data.errorDistribution.slice(0, 6)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="errorMessage" tick={{ fontSize: 8 }} interval={0} angle={-30} textAnchor="end" height={40} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={{ fontSize: "10px" }} />
                  <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* 服务商健康度 - 雷达图 */}
        <Card className="rounded-xl border-0 shadow-sm">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <ActivityIcon className="h-4 w-4 text-cyan-500" />
              <span className="font-semibold text-sm">服务健康度</span>
            </div>
            {data?.providerHealth && data.providerHealth.length > 0 ? (
              <ResponsiveContainer width="100%" height={140}>
                <RadarChart data={data.providerHealth.slice(0, 6).map(p => ({ name: p.name.slice(0, 4), health: p.status === "active" ? 100 : 0, response: Math.max(0, 100 - (p.responseTime || 0) / 10) }))}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
                  <Radar name="健康度" dataKey="health" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                  <Radar name="响应" dataKey="response" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>
      </div>

      {/* 实时错误日志 */}
      {data?.recentErrors && data.recentErrors.length > 0 && (
        <Card className="rounded-xl border-0 shadow-sm border-l-4 border-l-red-500">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="font-semibold text-sm">最近错误日志</span>
              <Badge variant="destructive" className="text-[9px]">{data.recentErrors.length}条</Badge>
            </div>
            <div className="h-[200px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              <div className="space-y-2">
                {data.recentErrors.slice(0, 20).map((err) => (
                  <div key={err.id} className="flex items-start gap-3 p-2 rounded-lg bg-red-50/50 border border-red-100">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[9px] border-red-200 text-red-700">{err.providerName}</Badge>
                        <span className="text-[10px] text-muted-foreground">{err.modelName}</span>
                        <span className="text-[9px] text-muted-foreground ml-auto">{new Date(err.createdAt).toLocaleTimeString("zh-CN")}</span>
                      </div>
                      <p className="text-[11px] text-red-700 mt-1 truncate" title={err.errorMessage}>{err.errorMessage}</p>
                      {err.requestPath && (
                        <p className="text-[9px] text-muted-foreground mt-0.5">{err.requestPath} {err.statusCode && `(Status: ${err.statusCode})`}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center h-[140px] text-muted-foreground">
      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-1">
        <BarChart3 className="h-5 w-5 text-slate-300" />
      </div>
      <p className="text-xs">暂无数据</p>
    </div>
  );
}
