"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Globe, Link, LayoutDashboard } from "lucide-react"
import { TimelineChart } from "./TimelineChart"

interface OverviewTabProps {
  targetDomain: string
}

interface TopItem {
  fullHostname?: string
  path?: string
  credentialCount: number
}

interface RankingListProps {
  title: string
  icon: React.ElementType
  data: TopItem[]
  colorClass: string
  barColorClass: string
  textColorClass?: string // Optional text color, defaults to colorClass
  isLoading: boolean
  targetDomain?: string
}

export function OverviewTab({ targetDomain }: OverviewTabProps) {
  const [topSubdomains, setTopSubdomains] = useState<TopItem[]>([])
  const [topPaths, setTopPaths] = useState<TopItem[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [timelineGranularity, setTimelineGranularity] = useState<"auto" | "weekly" | "monthly">("auto")

  useEffect(() => {
    loadOverviewData()
  }, [targetDomain, timelineGranularity])

  const loadOverviewData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/domain-recon/overview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetDomain,
          timelineGranularity,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log("📥 Overview data received:", {
          topSubdomains: data.topSubdomains?.length || 0,
          topPaths: data.topPaths?.length || 0,
          timeline: data.timeline?.length || 0,
          success: data.success,
          timelineIsArray: Array.isArray(data.timeline),
          timelineSample: data.timeline?.slice(0, 3),
          fullTimeline: data.timeline,
        })
        setTopSubdomains(data.topSubdomains || [])
        setTopPaths(data.topPaths || [])
        
        // Ensure timeline is an array
        if (Array.isArray(data.timeline)) {
          console.log("✅ Setting timeline data:", data.timeline.length, "items")
          setTimeline(data.timeline)
        } else {
          console.warn("⚠️ Timeline is not an array:", data.timeline)
          setTimeline([])
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error("❌ Overview API error:", response.status, errorData)
        setTopSubdomains([])
        setTopPaths([])
        setTimeline([])
      }
    } catch (error) {
      console.error("Error loading overview data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Timeline Chart - Moved to Top */}
      <Card className="bg-bron-bg-tertiary border-bron-border">
        <CardHeader className="!p-4">
          <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-bron-text-primary text-lg">
              <LayoutDashboard className="h-4 w-4 mr-2 text-bron-text-muted" />
              Credentials Exposure Over Time
          </CardTitle>
            <Select 
              value={timelineGranularity} 
              onValueChange={(value: "auto" | "weekly" | "monthly") => setTimelineGranularity(value)}
            >
              <SelectTrigger className="w-32 h-8 text-xs bg-bron-bg-secondary border-bron-border text-bron-text-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            </div>
        </CardHeader>
        <CardContent className="!p-4 !pt-0">
          <TimelineChart 
            data={timeline} 
            targetDomain={targetDomain}
            onGranularityChange={setTimelineGranularity}
          />
        </CardContent>
      </Card>

      {/* Top 10 Subdomains and Paths - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Subdomains */}
        <RankingList
          title="Top 10 Subdomains"
          icon={Globe}
          data={topSubdomains}
          colorClass="text-bron-accent-red"
          barColorClass="bg-bron-accent-red"
          textColorClass="text-bron-text-secondary"
          isLoading={isLoading}
          targetDomain={targetDomain}
        />

        {/* Top 10 Paths */}
        <RankingList
          title="Top 10 Paths"
          icon={Link}
          data={topPaths}
          colorClass="text-[#ff6b6b]"
          barColorClass="bg-[#ff6b6b]"
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}

// RankingList Component with Horizontal Bar Style
function RankingList({ title, icon: Icon, data, colorClass, barColorClass, textColorClass, isLoading, targetDomain }: RankingListProps) {
  const displayData = data.slice(0, 10)
  const maxVal = displayData.length > 0 ? Math.max(...displayData.map(d => d.credentialCount)) : 0
  // Use textColorClass if provided, otherwise fall back to colorClass
  const finalTextColorClass = textColorClass || colorClass

  return (
    <Card className="bg-bron-bg-tertiary border-bron-border h-full flex flex-col">
      <CardHeader className="!p-4 border-b border-bron-border">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-bron-text-primary text-lg">
            <Icon className="h-4 w-4 mr-2 text-bron-text-muted" />
            {title}
          </CardTitle>
          <span className="text-xs text-bron-text-muted">Top 10 by Volume</span>
        </div>
      </CardHeader>
      <CardContent className="!px-4 !pb-4 !pt-5 flex-1 overflow-auto">
        {isLoading ? (
          <p className="text-bron-text-muted">Loading...</p>
        ) : displayData.length > 0 ? (
          <div className="space-y-3">
            {displayData.map((item, index) => {
              const widthPercent = maxVal > 0 ? (item.credentialCount / maxVal) * 100 : 0
              const displayName = item.fullHostname || item.path || targetDomain || "/"

              return (
                <div key={index} className="group relative flex items-center text-sm">
                  {/* Rank Number */}
                  <span className="w-6 text-xs font-mono text-bron-text-muted opacity-50">
                    {index + 1}
                  </span>

                  {/* Progress Bar Container */}
                  <div className="flex-1 relative h-8 bg-bron-bg-secondary rounded overflow-hidden border border-bron-border">
                    {/* Progress Bar Background */}
                    <div
                      className={`absolute top-0 left-0 h-full ${barColorClass} opacity-15 transition-all duration-500`}
                      style={{ width: `${widthPercent}%` }}
                    />

                    {/* Content inside the bar */}
                    <div className="absolute inset-0 flex items-center justify-between px-3">
                      <span className={`font-mono truncate z-10 ${finalTextColorClass} font-medium`}>
                        {displayName}
                      </span>
                      <span className="text-xs font-bold text-bron-text-muted z-10 bg-bron-bg-tertiary/50 px-1 rounded">
                        {item.credentialCount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-bron-text-muted">
            {title.includes("Subdomains") ? "No subdomain data available" : "No path data available"}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

