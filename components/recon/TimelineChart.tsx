"use client"

import { useState, useEffect } from "react"
import {
  AreaChart,
  Area,
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

export function TimelineChart({ data: initialData, targetDomain: _targetDomain, onGranularityChange }: TimelineChartProps) {
  const [granularity, setGranularity] = useState<"auto" | "weekly" | "monthly">("auto")
  void setGranularity // Used only for internal state management
  
  // Use initialData directly, no need for internal state that causes delay
  const data = Array.isArray(initialData) ? initialData : []

  useEffect(() => {
    console.log("📊 TimelineChart received data:", {
      dataLength: data?.length || 0,
      isArray: Array.isArray(initialData),
      sample: data?.slice(0, 3),
      fullData: initialData,
      type: typeof initialData,
    })
  }, [initialData, data])

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
        <p className="text-muted-foreground">No timeline data available</p>
      </div>
    )
  }

  console.log("📊 TimelineChart rendering with data:", data.length, "items")

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart 
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#dc2626" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#52525b" strokeWidth={1} />
          <XAxis
            dataKey="date"
            stroke="#52525b"
            tick={{ fill: "#71717a", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis
            stroke="#52525b"
            tick={{ fill: "#71717a", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            dx={-10}
            tickFormatter={(value: number) => value.toLocaleString()}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b", 
              borderColor: "#27272a", 
              color: "#fff",
              border: "1px solid #27272a"
            }}
            itemStyle={{ color: "#fca5a5" }}
            labelStyle={{ color: "#a1a1aa", marginBottom: "0.25rem" }}
            cursor={{ stroke: "#dc2626", strokeWidth: 1, strokeDasharray: "4 4" }}
            formatter={(value: number) => value.toLocaleString()}
          />
          <Area
            type="monotone"
            dataKey="credentialCount"
            stroke="#dc2626"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRed)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

