"use client"

import { useState, useEffect } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface TimelineChartProps {
  data: Array<{
    date: string
    credentialCount: number
  }>
  targetDomain: string
  onGranularityChange?: (granularity: "auto" | "weekly" | "monthly") => void
}

export function TimelineChart({ data: initialData, targetDomain, onGranularityChange }: TimelineChartProps) {
  const [granularity, setGranularity] = useState<"auto" | "weekly" | "monthly">("auto")
  const [data, setData] = useState(initialData)

  useEffect(() => {
    console.log("📊 TimelineChart received data:", {
      dataLength: initialData?.length || 0,
      isArray: Array.isArray(initialData),
      sample: initialData?.slice(0, 3),
      fullData: initialData,
      type: typeof initialData,
    })
    
    // Ensure data is an array
    if (Array.isArray(initialData) && initialData.length > 0) {
      console.log("✅ Setting timeline data:", initialData.length, "items")
      setData(initialData)
    } else {
      console.warn("⚠️ Invalid timeline data format:", initialData)
      setData([])
    }
  }, [initialData])

  useEffect(() => {
    if (onGranularityChange) {
      console.log("📊 Granularity changed to:", granularity)
      onGranularityChange(granularity)
    }
  }, [granularity, onGranularityChange])

  if (!data || data.length === 0) {
    console.warn("⚠️ TimelineChart: No data available")
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-bron-text-muted">No timeline data available</p>
      </div>
    )
  }

  console.log("📊 TimelineChart rendering with data:", data.length, "items")

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--bron-border)" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="var(--bron-text-muted)"
            tick={{ fill: "var(--bron-text-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis
            stroke="var(--bron-text-muted)"
            tick={{ fill: "var(--bron-text-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            dx={-10}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bron-bg-secondary)",
              border: "1px solid var(--bron-border)",
              color: "var(--bron-text-primary)",
            }}
            itemStyle={{ color: "var(--bron-accent-red)" }}
          />
          <Line
            type="monotone"
            dataKey="credentialCount"
            stroke="var(--bron-accent-red)"
            strokeWidth={2}
            dot={{ fill: "var(--bron-accent-red)", r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

