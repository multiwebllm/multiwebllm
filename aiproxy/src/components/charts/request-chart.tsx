"use client"

import { useEffect, useState } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Skeleton } from "@/components/ui/skeleton"

interface RequestDataPoint {
  date: string
  count: number
}

const placeholderData: RequestDataPoint[] = Array.from({ length: 7 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - (6 - i))
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    count: 0,
  }
})

export function RequestChart() {
  const [data, setData] = useState<RequestDataPoint[]>(placeholderData)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/admin/usage?chart=requests")
        if (!res.ok) throw new Error("Failed to fetch")
        const json = await res.json()
        if (Array.isArray(json) && json.length > 0) {
          setData(json)
        }
      } catch {
        // keep placeholder data on error
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    )
  }

  return (
    <div>
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">
        请求趋势 (7天)
      </h3>
      {data.every((d) => d.count === 0) ? (
        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
          暂无请求数据
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 4, fill: "hsl(var(--primary))" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
