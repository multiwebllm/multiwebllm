"use client"

import { useEffect, useState } from "react"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Skeleton } from "@/components/ui/skeleton"

interface ProviderDataPoint {
  name: string
  value: number
}

const COLORS = [
  "hsl(var(--chart-1, 220 70% 50%))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
  "hsl(210 60% 40%)",
  "hsl(150 50% 50%)",
  "hsl(45 90% 50%)",
]

export function ProviderPieChart() {
  const [data, setData] = useState<ProviderDataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/admin/usage?chart=providers")
        if (!res.ok) throw new Error("Failed to fetch")
        const json = await res.json()
        if (Array.isArray(json) && json.length > 0) {
          setData(json)
        }
      } catch {
        // keep empty data on error
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
        <Skeleton className="mx-auto h-[300px] w-[300px] rounded-full" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div>
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">
          服务商用量分布
        </h3>
        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
          暂无服务商数据
        </div>
      </div>
    )
  }

  return (
    <div>
      <h3 className="mb-4 text-sm font-medium text-muted-foreground">
        服务商用量分布
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }: // eslint-disable-next-line @typescript-eslint/no-explicit-any
              any) => `${name || ""} (${((percent ?? 0) * 100).toFixed(0)}%)`
            }
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
