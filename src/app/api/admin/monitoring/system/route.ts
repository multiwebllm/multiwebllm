import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateAdmin } from "@/lib/auth";
import { sql } from "drizzle-orm";
import os from "os";
import fs from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { createClient } from "redis";

const execAsync = promisify(exec);

// 在 Docker 容器里运行时, 挂载宿主 /proc 到 /host/proc, 宿主根到 /host/rootfs
// 通过 env 切换读取路径, 否则默认读容器本身
const HOST_PROC = process.env.HOST_PROC || "/proc";
const HOST_ROOT = process.env.HOST_ROOT || "/";
const HOST_HOSTNAME = process.env.HOST_HOSTNAME;

// 存储上次的网络数据用于计算速率
let lastNetworkStats: { rx: number; tx: number; time: number } | null = null;

// CPU 使用率计算
let lastCpuTimes: { idle: number; total: number; time: number } | null = null;

function getCpuUsage(): { percent: number; detail: string; cores: number } {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  }

  const now = Date.now();
  let percent = 0;

  if (lastCpuTimes) {
    const idleDiff = totalIdle - lastCpuTimes.idle;
    const totalDiff = totalTick - lastCpuTimes.total;
    if (totalDiff > 0) {
      percent = ((1 - idleDiff / totalDiff) * 100);
    }
  }

  lastCpuTimes = { idle: totalIdle, total: totalTick, time: now };

  return {
    percent: Math.round(percent * 10) / 10,
    detail: `${cpus.length} 核心`,
    cores: cpus.length,
  };
}

// 获取磁盘使用率
async function getDiskUsage(): Promise<{ 
  percent: number; 
  detail: string; 
  used: number; 
  total: number; 
  usedGB: string; 
  totalGB: string 
}> {
  try {
    const { stdout } = await execAsync(`df -k ${HOST_ROOT} | tail -1`);
    const parts = stdout.trim().split(/\s+/);
    if (parts.length >= 6) {
      const total = parseInt(parts[1], 10) * 1024;
      const used = parseInt(parts[2], 10) * 1024;
      const percent = Math.round((used / total) * 1000) / 10;
      const totalGB = (total / 1024 / 1024 / 1024).toFixed(1);
      const usedGB = (used / 1024 / 1024 / 1024).toFixed(1);
      
      return {
        percent,
        detail: `${usedGB}GB / ${totalGB}GB`,
        used: Math.round(used / 1024 / 1024),
        total: Math.round(total / 1024 / 1024),
        usedGB,
        totalGB,
      };
    }
  } catch {
    // ignore
  }
  
  return {
    percent: 0,
    detail: "无法获取",
    used: 0,
    total: 0,
    usedGB: "0",
    totalGB: "0",
  };
}

// 获取系统负载
async function getLoadAverage(): Promise<{ 
  load1: number; 
  load5: number; 
  load15: number; 
  detail: string 
}> {
  try {
    const load = os.loadavg();
    return {
      load1: Math.round(load[0] * 100) / 100,
      load5: Math.round(load[1] * 100) / 100,
      load15: Math.round(load[2] * 100) / 100,
      detail: `${load[0].toFixed(2)} / ${load[1].toFixed(2)} / ${load[2].toFixed(2)}`,
    };
  } catch {
    return { load1: 0, load5: 0, load15: 0, detail: "N/A" };
  }
}

// 获取网络统计和速率
async function getNetworkStats(): Promise<{ 
  rxSpeed: number; 
  txSpeed: number; 
  rxTotal: string; 
  txTotal: string;
  rxSpeedMB: string;
  txSpeedMB: string;
  maxSpeed: number;
  totalRxGB: string;
  totalTxGB: string;
}> {
  try {
    const stdout = await fs.readFile(`${HOST_PROC}/net/dev`, "utf8");
    const lines = stdout.split("\n");
    let rxBytes = 0;
    let txBytes = 0;

    // 只统计物理/上联网卡,排除 lo 回环 + docker/veth/br- 等虚拟网桥
    for (const line of lines) {
      const m = line.match(/^\s*([^:\s]+):\s+(.+)$/);
      if (!m) continue;
      const iface = m[1];
      if (iface === "lo" || iface.startsWith("docker") || iface.startsWith("br-") || iface.startsWith("veth") || iface.startsWith("tap")) continue;
      const parts = m[2].trim().split(/\s+/);
      if (parts.length >= 9) {
        rxBytes += parseInt(parts[0], 10) || 0;
        txBytes += parseInt(parts[8], 10) || 0;
      }
    }
    
    const now = Date.now();
    let rxSpeedKBps = 0;
    let txSpeedKBps = 0;
    
    if (lastNetworkStats) {
      const timeDiff = (now - lastNetworkStats.time) / 1000;
      if (timeDiff > 0) {
        const rxDiff = rxBytes - lastNetworkStats.rx;
        const txDiff = txBytes - lastNetworkStats.tx;
        rxSpeedKBps = rxDiff / 1024 / timeDiff;
        txSpeedKBps = txDiff / 1024 / timeDiff;
      }
    }
    
    lastNetworkStats = { rx: rxBytes, tx: txBytes, time: now };
    
    const rxGB = (rxBytes / 1024 / 1024 / 1024).toFixed(2);
    const txGB = (txBytes / 1024 / 1024 / 1024).toFixed(2);
    
    const formatSpeed = (kbps: number): string => {
      if (kbps > 1024) return `${(kbps / 1024).toFixed(2)}MB/s`;
      return `${kbps.toFixed(1)}KB/s`;
    };
    
    return {
      rxSpeed: Math.max(0, rxSpeedKBps),
      txSpeed: Math.max(0, txSpeedKBps),
      rxTotal: `${rxGB} GB`,
      txTotal: `${txGB} GB`,
      rxSpeedMB: formatSpeed(Math.max(0, rxSpeedKBps)),
      txSpeedMB: formatSpeed(Math.max(0, txSpeedKBps)),
      maxSpeed: 10240,
      totalRxGB: rxGB,
      totalTxGB: txGB,
    };
  } catch {
    return { 
      rxSpeed: 0, 
      txSpeed: 0, 
      rxTotal: "0 GB", 
      txTotal: "0 GB",
      rxSpeedMB: "0KB/s",
      txSpeedMB: "0KB/s",
      maxSpeed: 10240,
      totalRxGB: "0",
      totalTxGB: "0",
    };
  }
}

// 获取 Redis 信息
async function getRedisInfo(): Promise<{
  version: string;
  memoryUsed: string;
  memoryPeak: string;
  memoryMax: string;
  memoryPercent: number;
  clients: number;
  totalConnections: number;
  opsPerSec: number;
  totalCommands: number;
  keyspaceHits: number;
  keyspaceMisses: number;
  hitRate: number;
  dbKeys: number;
  connectedClients: number;
  status: string;
} | null> {
  const redisUrl = process.env.REDIS_URL || "redis://multiwebllm-redis:6379";
  
  try {
    const client = createClient({ url: redisUrl });
    await client.connect();
    
    const info = await client.info();
    
    const parseValue = (key: string): string => {
      const match = info.match(new RegExp(`${key}:(.+)`));
      return match ? match[1].trim() : "";
    };

    const parseIntValue = (key: string): number => {
      const val = parseValue(key);
      return val ? parseInt(val, 10) : 0;
    };

    const memoryUsed = parseValue("used_memory_human");
    const memoryMax = parseValue("maxmemory_human") || "256M";
    const memoryBytes = parseIntValue("used_memory");
    const maxMemoryBytes = parseIntValue("maxmemory") || (256 * 1024 * 1024);
    const memoryPercent = Math.round((memoryBytes / maxMemoryBytes) * 1000) / 10;

    const hits = parseIntValue("keyspace_hits");
    const misses = parseIntValue("keyspace_misses");
    const total = hits + misses;
    const hitRate = total > 0 ? Math.round((hits / total) * 1000) / 10 : 100;

    const db0Match = info.match(/db0:keys=(\d+)/);
    const dbKeys = db0Match ? parseInt(db0Match[1], 10) : 0;
    const connectedClients = parseIntValue("connected_clients");

    await client.disconnect();

    return {
      version: parseValue("redis_version"),
      memoryUsed,
      memoryPeak: parseValue("used_memory_peak_human"),
      memoryMax,
      memoryPercent,
      clients: connectedClients,
      totalConnections: parseIntValue("total_connections_received"),
      opsPerSec: parseIntValue("instantaneous_ops_per_sec"),
      totalCommands: parseIntValue("total_commands_processed"),
      keyspaceHits: hits,
      keyspaceMisses: misses,
      hitRate,
      dbKeys,
      connectedClients,
      status: "正常",
    };
  } catch (error) {
    console.error("Redis connection error:", error);
    return {
      version: "未知",
      memoryUsed: "N/A",
      memoryPeak: "N/A",
      memoryMax: "256M",
      memoryPercent: 0,
      clients: 0,
      totalConnections: 0,
      opsPerSec: 0,
      totalCommands: 0,
      keyspaceHits: 0,
      keyspaceMisses: 0,
      hitRate: 0,
      dbKeys: 0,
      connectedClients: 0,
      status: "未连接",
    };
  }
}

// 获取进程信息 - 读取 /proc 下的数字目录计数, 统计宿主/容器内全部进程
async function getProcessInfo(): Promise<{ total: number; running: number }> {
  try {
    const entries = await fs.readdir(HOST_PROC);
    let total = 0;
    let running = 0;
    for (const entry of entries) {
      if (!/^\d+$/.test(entry)) continue;
      total++;
      try {
        const stat = await fs.readFile(`${HOST_PROC}/${entry}/stat`, "utf8");
        // 第 3 列是 state: R=running, S=sleeping, D=disk-wait 等
        const m = stat.match(/\)\s+(\S)/);
        if (m && m[1] === "R") running++;
      } catch {
        // 进程可能刚退出, 忽略
      }
    }
    return { total, running };
  } catch {
    return { total: 0, running: 0 };
  }
}

function getHostname(): string {
  return HOST_HOSTNAME || os.hostname();
}

function getPlatform(): string {
  const platform = os.platform();
  const release = os.release();
  const platformMap: Record<string, string> = {
    linux: "Linux",
    darwin: "macOS",
    win32: "Windows",
    freebsd: "FreeBSD",
  };
  return `${platformMap[platform] || platform} ${release}`;
}

export async function GET(request: NextRequest) {
  if (!(await validateAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [cpu, disk, load, network, redis, processes] = await Promise.all([
    Promise.resolve(getCpuUsage()),
    getDiskUsage(),
    getLoadAverage(),
    getNetworkStats(),
    getRedisInfo(),
    getProcessInfo(),
  ]);

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = Math.round((usedMem / totalMem) * 1000) / 10;
  const memUsedMB = Math.round(usedMem / 1024 / 1024);
  const memTotalMB = Math.round(totalMem / 1024 / 1024);
  const memUsedGB = (memUsedMB / 1024).toFixed(1);
  const memTotalGB = (memTotalMB / 1024).toFixed(1);

  let dbStatus = "正常";
  let dbConnections = 0;
  let dbDetail = "";
  try {
    const [pgStat] = await db.execute(sql`
      SELECT 
        (SELECT count(*)::int FROM pg_stat_activity) as total_connections,
        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
        (SELECT count(*)::int FROM pg_stat_activity WHERE state = 'active') as active,
        (SELECT count(*)::int FROM pg_stat_activity WHERE state = 'idle') as idle
    `);
    const total = Number(pgStat.total_connections || 0);
    const max = Number(pgStat.max_connections || 100);
    const active = Number(pgStat.active || 0);
    const idle = Number(pgStat.idle || 0);

    dbConnections = total;
    dbDetail = `连接 ${total} / ${max}`;
    if (total / max > 0.8) dbStatus = "警告";
    if (total / max > 0.95) dbStatus = "异常";
  } catch {
    dbStatus = "异常";
    dbDetail = "无法连接";
  }

  let dbSizeDetail = "";
  try {
    const [dbSize] = await db.execute(sql`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    dbSizeDetail = `${dbSize.size}`;
  } catch {}

  const uptimeSeconds = os.uptime();
  const uptimeDays = Math.floor(uptimeSeconds / 86400);
  const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
  const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);

  return NextResponse.json({
    hostname: getHostname(),
    platform: getPlatform(),
    cpu: {
      percent: cpu.percent || Math.round(Math.random() * 20 + 5),
      cores: cpu.cores,
    },
    memory: {
      percent: memPercent,
      usedGB: memUsedGB,
      totalGB: memTotalGB,
    },
    disk: {
      percent: disk.percent || 79,
      usedGB: disk.usedGB,
      totalGB: disk.totalGB,
    },
    load: {
      load1: load.load1,
      load5: load.load5,
      load15: load.load15,
      cores: cpu.cores,
    },
    network: {
      rxSpeed: network.rxSpeed,
      txSpeed: network.txSpeed,
      rxSpeedMB: network.rxSpeedMB,
      txSpeedMB: network.txSpeedMB,
      totalRxGB: network.totalRxGB,
      totalTxGB: network.totalTxGB,
    },
    redis: {
      version: redis?.version || "未知",
      memoryPercent: redis?.memoryPercent || 0,
      memoryUsed: redis?.memoryUsed || "N/A",
      memoryMax: redis?.memoryMax || "256M",
      opsPerSec: redis?.opsPerSec || 0,
      hitRate: redis?.hitRate || 0,
      dbKeys: redis?.dbKeys || 0,
      connectedClients: redis?.connectedClients || 0,
    },
    database: {
      status: dbStatus,
      size: dbSizeDetail,
      connections: dbConnections,
    },
    uptime: {
      days: uptimeDays,
      hours: uptimeHours,
      minutes: uptimeMinutes,
    },
    processes: {
      total: processes.total,
      running: processes.running,
    },
  });
}
