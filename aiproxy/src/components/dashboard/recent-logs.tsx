"use client"

import { useEffect, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

interface LogEntry {
  id: string
  time: string
  model: string
  tokens: number
  latency: number
  status: number
}

function statusVariant(status: number) {
  if (status >= 200 && status < 300) return "secondary" as const
  if (status >= 400 && status < 500) return "outline" as const
  return "destructive" as const
}

function formatTime(time: string) {
  try {
    return new Date(time).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    return time
  }
}

export function RecentLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch("/api/admin/usage?recent=20")
        if (!res.ok) throw new Error("Failed to fetch")
        const json = await res.json()
        if (Array.isArray(json)) {
          setLogs(json)
        }
      } catch {
        // keep empty on error
      } finally {
        setLoading(false)
      }
    }
    fetchLogs()
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-48" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">
        最近请求日志
      </h3>
      {logs.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          暂无请求日志
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>模型</TableHead>
              <TableHead className="text-right">Token</TableHead>
              <TableHead className="text-right">延迟</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-muted-foreground">
                  {formatTime(log.time)}
                </TableCell>
                <TableCell className="font-mono text-xs">{log.model}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {log.tokens.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {log.latency}ms
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(log.status)}>
                    {log.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
