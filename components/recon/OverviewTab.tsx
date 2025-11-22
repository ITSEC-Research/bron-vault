"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Globe, Link, LayoutDashboard, Key } from "lucide-react"
import { TimelineChart } from "./TimelineChart"

interface OverviewTabProps {
  targetDomain: string
  searchType?: 'domain' | 'keyword'
  keywordMode?: 'domain-only' | 'full-url'
}

interface TopItem {
  fullHostname?: string
  path?: string
  credentialCount: number
}

interface TopPassword {
  password: string
  total_count: number
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

export function OverviewTab({ targetDomain, searchType = 'domain', keywordMode }: OverviewTabProps) {
  const [topSubdomains, setTopSubdomains] = useState<TopItem[]>([])
  const [topPaths, setTopPaths] = useState<TopItem[]>([])
  const [topPasswords, setTopPasswords] = useState<TopPassword[]>([])
  const [isPasswordsLoading, setIsPasswordsLoading] = useState(false)
  const [timeline, setTimeline] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [timelineGranularity, setTimelineGranularity] = useState<"auto" | "weekly" | "monthly">("auto")

  useEffect(() => {
    loadOverviewData()
  }, [targetDomain, timelineGranularity, searchType, keywordMode])

  // Load passwords separately after main data is loaded
  useEffect(() => {
    if (!isLoading && targetDomain) {
      loadPasswords()
    }
  }, [targetDomain, searchType, keywordMode, isLoading])

  const loadOverviewData = async () => {
    setIsLoading(true)
    try {
      const body: any = {
        targetDomain,
        timelineGranularity,
        searchType,
      }
      if (searchType === 'keyword' && keywordMode) {
        body.keywordMode = keywordMode
      }
      const response = await fetch("/api/domain-recon/overview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
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
          topSubdomainsSample: data.topSubdomains?.slice(0, 2),
          topPathsSample: data.topPaths?.slice(0, 2),
        })
        // Set all data at once to avoid race conditions
        const timelineData = Array.isArray(data.timeline) ? data.timeline : []
        console.log("✅ Setting all data:", {
          timeline: timelineData.length,
          subdomains: (data.topSubdomains || []).length,
          paths: (data.topPaths || []).length,
        })
        
        setTopSubdomains(data.topSubdomains || [])
        setTopPaths(data.topPaths || [])
        setTimeline(timelineData)
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

  const loadPasswords = async () => {
    setIsPasswordsLoading(true)
    try {
      const body: any = {
        targetDomain,
        searchType,
      }
      if (searchType === 'keyword' && keywordMode) {
        body.keywordMode = keywordMode
      }
      const response = await fetch("/api/domain-recon/passwords", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const data = await response.json()
        console.log("🔑 Passwords data received:", {
          topPasswords: data.topPasswords?.length || 0,
        })
        setTopPasswords(data.topPasswords || [])
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error("❌ Passwords API error:", response.status, errorData)
        setTopPasswords([])
      }
    } catch (error) {
      console.error("Error loading passwords data:", error)
      setTopPasswords([])
    } finally {
      setIsPasswordsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Timeline Chart and Top 10 Passwords - Side by Side */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Timeline Chart - Larger width for better time visibility */}
        <Card className="bg-bron-bg-tertiary border-bron-border flex-[2] min-w-[60%]">
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

        {/* Top 10 Passwords - Smaller width */}
        <div className="flex-1 max-w-[40%]">
          <TopPasswordsList 
            data={topPasswords}
            isLoading={isPasswordsLoading}
          />
        </div>
      </div>

      {/* Top 10 Subdomains and Paths - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Subdomains */}
        <RankingList
          title="Top 10 Subdomains"
          icon={Globe}
          data={topSubdomains}
          colorClass="text-bron-accent-red"
          barColorClass="bg-blue-500"
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
          barColorClass="bg-red-500"
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
      <CardContent className="!pl-2 !pr-3 !pb-3 !pt-3 flex-1 overflow-auto">
        {isLoading ? (
          <p className="text-bron-text-muted text-sm">Loading...</p>
        ) : displayData.length > 0 ? (
          <div className="space-y-0.5">
            {displayData.map((item, index) => {
              const widthPercent = maxVal > 0 ? (item.credentialCount / maxVal) * 100 : 0
              const displayName = item.fullHostname || item.path || targetDomain || "/"

              return (
                <div key={index} className="group relative flex items-center py-1 pl-0 pr-2 rounded-lg hover:bg-bron-bg-secondary/50 transition-colors">
                  {/* Rank Number */}
                  <span className="w-8 text-xs font-mono text-bron-text-muted text-center mr-2">
                    {index + 1}
                  </span>

                  {/* Progress Bar Container */}
                  <div className="flex-1 relative h-8 bg-bron-bg-secondary/50 rounded-md overflow-hidden border border-bron-border group-hover:border-bron-border/70 transition-colors">
                    {/* Background Progress Bar */}
                    <div
                      className={`absolute top-0 left-0 h-full ${barColorClass} opacity-10 group-hover:opacity-20 transition-all duration-500`}
                      style={{ width: `${widthPercent}%` }}
                    />
                    {/* Bottom accent line for progress */}
                    <div
                      className={`absolute bottom-0 left-0 h-[2px] ${barColorClass} opacity-60 group-hover:opacity-100 transition-all duration-500`}
                      style={{ width: `${widthPercent}%` }}
                    />
                    {/* Content inside the bar */}
                    <div className="absolute inset-0 flex items-center justify-between px-3">
                      <span className={`font-mono text-xs text-bron-text-secondary truncate z-10 max-w-[70%]`}>
                        {displayName}
                      </span>
                      <span className="text-[10px] font-bold text-bron-text-muted bg-bron-bg-tertiary px-1.5 py-0.5 rounded border border-bron-border z-10">
                        {item.credentialCount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-bron-text-muted text-sm">
            {title.includes("Subdomains") ? "No subdomain data available" : "No path data available"}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// TopPasswordsList Component with Horizontal Bar Style
interface TopPasswordsListProps {
  data: TopPassword[]
  isLoading: boolean
}

function TopPasswordsList({ data, isLoading }: TopPasswordsListProps) {
  const displayData = data.slice(0, 10)
  const maxVal = displayData.length > 0 ? Math.max(...displayData.map(d => d.total_count)) : 0
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const scrollCountRef = useRef(0)

  // Effect 1: Reset index saat data baru dimuat
  useEffect(() => {
    if (!isLoading && displayData.length > 0) {
      setCurrentIndex(0)
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0
      }
    }
  }, [isLoading, data, displayData.length])

  // Effect 2: Timer Logic - Mengubah index setiap 2 detik, reset setelah 8 detik (4 item)
  useEffect(() => {
    if (isLoading || displayData.length === 0) return

    // Reset counter saat effect dimulai
    scrollCountRef.current = 0
    const maxScrolls = 4 // 4 item = 8 detik

    const interval = setInterval(() => {
      scrollCountRef.current++
      
      if (scrollCountRef.current >= maxScrolls) {
        // Setelah 8 detik (4 item), reset ke index 0
        setCurrentIndex(0)
        scrollCountRef.current = 0
      } else {
        // Scroll ke item berikutnya
        setCurrentIndex((prev) => prev + 1)
      }
    }, 2000) // 2 seconds

    return () => clearInterval(interval)
  }, [isLoading, displayData.length])

  // Effect 3: Scroll Logic Manual (Fix untuk delay & alignment)
  useEffect(() => {
    if (displayData.length === 0) return

    const container = scrollContainerRef.current
    const targetItem = itemRefs.current[currentIndex]

    if (!container) return

    // Khusus untuk index 0 (rank 1), langsung reset ke top tanpa smooth untuk menghindari stuck
    // Ini mengatasi masalah ketika loop kembali ke rank 1 dari rank 10
    if (currentIndex === 0) {
      // Reset langsung tanpa smooth untuk menghindari delay
      container.scrollTop = 0
    } else if (targetItem) {
      // Ambil posisi item relatif terhadap container
      const itemTop = targetItem.offsetTop

      // ADJUSTMENT: Kurangi dengan 12px (sesuai padding !pt-3) agar tidak nempel border atas
      // Ini menjaga konsistensi visual antara load pertama dan looping berikutnya
      const topBuffer = 12

      container.scrollTo({
        top: itemTop - topBuffer,
        behavior: 'smooth',
      })
    }
  }, [currentIndex, displayData.length])


  return (
    <Card className="bg-bron-bg-tertiary border-bron-border w-full flex flex-col h-full">
      <CardHeader className="!p-3 border-b border-bron-border">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-bron-text-primary text-base">
            <Key className="h-4 w-4 mr-2 text-bron-text-muted" />
            Top 10 Most Used Passwords
          </CardTitle>
          <span className="text-xs text-bron-text-muted">By Device Count</span>
        </div>
      </CardHeader>
      <CardContent 
        ref={scrollContainerRef}
        className="!pl-2 !pr-3 !pb-3 !pt-3 overflow-y-auto h-[300px] relative"
      >
        {isLoading ? (
          <p className="text-bron-text-muted text-sm">Loading...</p>
        ) : displayData.length > 0 ? (
          <div className="space-y-0.5">
            {displayData.map((item, index) => {
              const widthPercent = maxVal > 0 ? (item.total_count / maxVal) * 100 : 0
              const isTopOne = index === 0
              const displayPassword = item.password.length > 30
                ? item.password.substring(0, 30) + "..."
                : item.password
              const colorBase = isTopOne ? 'bg-red-500' : 'bg-orange-500'
              const isActive = index === currentIndex

              return (
                <div 
                  key={index} 
                  ref={(el) => { itemRefs.current[index] = el }}
                  className={`group relative flex items-center py-1 pl-0 pr-2 rounded-lg transition-colors duration-500 ${isActive ? 'bg-bron-bg-secondary/40' : 'hover:bg-bron-bg-secondary/50'}`}>
                  {/* Rank Number */}
                  <span className="w-8 text-xs font-mono text-bron-text-muted text-center mr-2">
                    {index + 1}
                  </span>

                  {/* Progress Bar Container */}
                  <div className="flex-1 relative h-8 bg-bron-bg-secondary/50 rounded-md overflow-hidden border border-bron-border group-hover:border-bron-border/70 transition-colors">
                    {/* Background Progress Bar */}
                    <div
                      className={`absolute top-0 left-0 h-full ${colorBase} opacity-10 group-hover:opacity-20 transition-all duration-500`}
                      style={{ width: `${widthPercent}%` }}
                    />
                    {/* Bottom accent line for progress */}
                    <div
                      className={`absolute bottom-0 left-0 h-[2px] ${colorBase} opacity-60 group-hover:opacity-100 transition-all duration-500`}
                      style={{ width: `${widthPercent}%` }}
                    />
                    {/* Content inside the bar */}
                    <div className="absolute inset-0 flex items-center justify-between px-3">
                      <span className="font-mono text-xs text-bron-text-secondary truncate z-10 max-w-[70%]">
                        {displayPassword}
                      </span>
                      <span className="text-[10px] font-bold text-bron-text-muted bg-bron-bg-tertiary px-1.5 py-0.5 rounded border border-bron-border z-10">
                        {item.total_count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-bron-text-muted text-sm">No password data available</p>
        )}
      </CardContent>
    </Card>
  )
}

