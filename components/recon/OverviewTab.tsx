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
import { LoadingState, LoadingChart, LoadingCard } from "@/components/ui/loading"

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
  const [isPasswordsLoading, setIsPasswordsLoading] = useState(true) // Start with true to show loading state initially
  const [timeline, setTimeline] = useState<any[]>([])
  // Separate loading states for progressive rendering
  const [loadingStates, setLoadingStates] = useState({
    stats: true,      // Subdomains + Paths (fast data)
    timeline: true,   // Timeline (slow data)
  })
  const [timelineGranularity, setTimelineGranularity] = useState<"auto" | "weekly" | "monthly">("auto")
  const passwordsRequestRef = useRef<AbortController | null>(null)

  // ============================================
  // SPLIT REQUESTS STRATEGY - Progressive Loading
  // ============================================
  // Load fast data (Stats) and slow data (Timeline) separately
  // This allows fast content to appear first (~200ms) while Timeline loads (~2s)
  useEffect(() => {
    const abortController = new AbortController()

    // Reset loading states
    setLoadingStates({ stats: true, timeline: true })
    setIsPasswordsLoading(true) // Reset passwords loading state
    
    // Cancel any previous passwords request
    if (passwordsRequestRef.current) {
      passwordsRequestRef.current.abort()
    }
    passwordsRequestRef.current = abortController

    // 1. Fast Request: Stats (Subdomains + Paths) - ~200ms
    const loadStats = async () => {
      try {
        const body: any = {
          targetDomain,
          searchType,
          type: 'stats', // Request only stats data
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
          signal: abortController.signal,
        })

        if (response.ok) {
          const data = await response.json()
          console.log("📥 Stats data received:", {
            topSubdomains: data.topSubdomains?.length || 0,
            topPaths: data.topPaths?.length || 0,
          })
          
          setTopSubdomains(data.topSubdomains || [])
          setTopPaths(data.topPaths || [])
          setLoadingStates(prev => ({ ...prev, stats: false }))
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.error("❌ Stats API error:", response.status, errorData)
          setTopSubdomains([])
          setTopPaths([])
          setLoadingStates(prev => ({ ...prev, stats: false }))
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error("Error loading stats data:", error)
          setTopSubdomains([])
          setTopPaths([])
          setLoadingStates(prev => ({ ...prev, stats: false }))
        }
      }
    }

    // 2. Slow Request: Timeline - ~2s
    const loadTimeline = async () => {
      try {
        const body: any = {
          targetDomain,
          timelineGranularity,
          searchType,
          type: 'timeline', // Request only timeline data
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
          signal: abortController.signal,
        })

        if (response.ok) {
          const data = await response.json()
          const timelineData = Array.isArray(data.timeline) ? data.timeline : []
          console.log("📥 Timeline data received:", {
            timeline: timelineData.length,
            timelineSample: timelineData.slice(0, 3),
          })
          
          setTimeline(timelineData)
          setLoadingStates(prev => ({ ...prev, timeline: false }))
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.error("❌ Timeline API error:", response.status, errorData)
          setTimeline([])
          setLoadingStates(prev => ({ ...prev, timeline: false }))
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error("Error loading timeline data:", error)
          setTimeline([])
          setLoadingStates(prev => ({ ...prev, timeline: false }))
        }
      }
    }

    // 3. Passwords Request - ~200ms (parallel with stats and timeline)
    const loadPasswordsParallel = async () => {
      // Ensure loading state is set before making request
      setIsPasswordsLoading(true)
      console.log("🔑 Starting to load passwords, isLoading set to true")
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
          signal: abortController.signal,
        })

        // Check if request was aborted before processing response
        if (abortController.signal.aborted) {
          console.log("🔑 Passwords request aborted before processing response")
          return
        }

        if (response.ok) {
          const data = await response.json()
          console.log("🔑 Passwords data received:", {
            topPasswords: data.topPasswords?.length || 0,
          })
          // Check again if request was aborted before setting state
          if (!abortController.signal.aborted) {
            setTopPasswords(data.topPasswords || [])
            setIsPasswordsLoading(false)
            console.log("🔑 Passwords loading complete, setting isLoading to false")
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.error("❌ Passwords API error:", response.status, errorData)
          if (!abortController.signal.aborted) {
            setTopPasswords([])
            setIsPasswordsLoading(false)
            console.log("🔑 Passwords loading complete (error), setting isLoading to false")
          }
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error("Error loading passwords data:", error)
          if (!abortController.signal.aborted) {
            setTopPasswords([])
            setIsPasswordsLoading(false)
            console.log("🔑 Passwords loading complete (exception), setting isLoading to false")
          }
        } else {
          // AbortError - don't update state, component is unmounting or new request started
          console.log("🔑 Passwords request aborted")
        }
      }
    }

    // Fire all 3 requests in parallel for maximum performance
    loadStats()
    loadTimeline()
    loadPasswordsParallel()

    // Cleanup: Cancel requests if component unmounts or dependencies change
    return () => {
      abortController.abort()
    }
  }, [targetDomain, timelineGranularity, searchType, keywordMode])

  return (
    <div className="space-y-6">
      {/* Timeline Chart and Top 10 Passwords - Side by Side */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Timeline Chart - Larger width for better time visibility */}
        <Card className="glass-card border-border/50 flex-[2] min-w-[60%]">
        <CardHeader className="!p-4">
          <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-foreground text-lg">
              <LayoutDashboard className="h-4 w-4 mr-2 text-muted-foreground" />
              Credentials Exposure Over Time
          </CardTitle>
            <Select 
              value={timelineGranularity} 
              onValueChange={(value: "auto" | "weekly" | "monthly") => setTimelineGranularity(value)}
            >
              <SelectTrigger className="w-32 h-8 text-xs bg-background/60 border-border/50 text-muted-foreground">
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
          {loadingStates.timeline ? (
            <div className="flex items-center justify-center h-[300px]">
              <LoadingState type="chart" message="Loading timeline data..." size="md" />
            </div>
          ) : (
            <TimelineChart 
              data={timeline} 
              targetDomain={targetDomain}
              onGranularityChange={setTimelineGranularity}
            />
          )}
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
          colorClass="text-primary"
          barColorClass="bg-blue-500"
          textColorClass="text-muted-foreground"
          isLoading={loadingStates.stats}
          targetDomain={targetDomain}
        />

        {/* Top 10 Paths */}
        <RankingList
          title="Top 10 Paths"
          icon={Link}
          data={topPaths}
          colorClass="text-[#ff6b6b]"
          barColorClass="bg-red-500"
          isLoading={loadingStates.stats}
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
    <Card className="glass-card border-border/50 h-full flex flex-col">
      <CardHeader className="!p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-foreground text-lg">
            <Icon className="h-4 w-4 mr-2 text-muted-foreground" />
            {title}
          </CardTitle>
          <span className="text-xs text-muted-foreground">Top 10 by Volume</span>
        </div>
      </CardHeader>
      <CardContent className="!pl-2 !pr-3 !pb-3 !pt-3 flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingState type="data" message="Loading..." size="sm" />
          </div>
        ) : displayData.length > 0 ? (
          <div className="space-y-0.5">
            {displayData.map((item, index) => {
              const widthPercent = maxVal > 0 ? (item.credentialCount / maxVal) * 100 : 0
              const displayName = item.fullHostname || item.path || targetDomain || "/"

              return (
                <div key={index} className="group relative flex items-center py-1 pl-0 pr-2 rounded-lg hover:bg-white/5 transition-colors">
                  {/* Rank Number */}
                  <span className="w-8 text-xs font-mono text-muted-foreground text-center mr-2">
                    {index + 1}
                  </span>

                  {/* Progress Bar Container */}
                  <div className="flex-1 relative h-8 bg-background/60 rounded-md overflow-hidden border border-border/50 group-hover:border-border/70 transition-colors">
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
                      <span className={`font-mono text-xs text-muted-foreground truncate z-10 max-w-[70%]`}>
                        {displayName}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground glass px-1.5 py-0.5 rounded border border-white/5 z-10">
                        {item.credentialCount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
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
  // Only calculate displayData if not loading to avoid unnecessary calculations
  const displayData = isLoading ? [] : data.slice(0, 10)
  const maxVal = displayData.length > 0 ? Math.max(...displayData.map(d => d.total_count)) : 0
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const scrollCountRef = useRef(0)

  // Effect 1: Reset index when new data is loaded
  useEffect(() => {
    if (!isLoading && displayData.length > 0) {
      setCurrentIndex(0)
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0
      }
    }
  }, [isLoading, data, displayData.length])

  // Effect 2: Timer Logic - Change index every 2 seconds, reset after 8 seconds (4 items)
  useEffect(() => {
    if (isLoading || displayData.length === 0) return

    // Reset counter when effect starts
    scrollCountRef.current = 0
    const maxScrolls = 4 // 4 items = 8 seconds

    const interval = setInterval(() => {
      scrollCountRef.current++
      
      if (scrollCountRef.current >= maxScrolls) {
        // After 8 seconds (4 items), reset to index 0
        setCurrentIndex(0)
        scrollCountRef.current = 0
      } else {
        // Scroll to next item
        setCurrentIndex((prev) => prev + 1)
      }
    }, 2000) // 2 seconds

    return () => clearInterval(interval)
  }, [isLoading, displayData.length])

  // Effect 3: Manual Scroll Logic (Fix for delay & alignment)
  useEffect(() => {
    if (displayData.length === 0) return

    const container = scrollContainerRef.current
    const targetItem = itemRefs.current[currentIndex]

    if (!container) return

    // Special case for index 0 (rank 1), directly reset to top without smooth to avoid stuck
    // This fixes the issue when loop returns to rank 1 from rank 10
    if (currentIndex === 0) {
      // Direct reset without smooth to avoid delay
      container.scrollTop = 0
    } else if (targetItem) {
      // Get item position relative to container
      const itemTop = targetItem.offsetTop

      // ADJUSTMENT: Subtract 12px (matching padding !pt-3) to avoid sticking to top border
      // This maintains visual consistency between first load and subsequent loops
      const topBuffer = 12

      container.scrollTo({
        top: itemTop - topBuffer,
        behavior: 'smooth',
      })
    }
  }, [currentIndex, displayData.length])


  return (
    <Card className="glass-card border-border/50 w-full flex flex-col h-full">
      <CardHeader className="!p-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-foreground text-base">
            <Key className="h-4 w-4 mr-2 text-muted-foreground" />
            Top 10 Most Used Passwords
          </CardTitle>
          <span className="text-xs text-muted-foreground">By Device Count</span>
        </div>
      </CardHeader>
      <CardContent 
        ref={scrollContainerRef}
        className="!pl-2 !pr-3 !pb-3 !pt-3 overflow-y-auto h-[300px] relative"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8 h-full">
            <LoadingState type="data" message="Loading passwords..." size="sm" />
          </div>
        ) : displayData.length > 0 ? (
          <div className="space-y-0.5">
            {displayData.map((item, index) => {
              const widthPercent = maxVal > 0 ? (item.total_count / maxVal) * 100 : 0
              const isTopOne = index === 0
              const displayPassword = item.password.length > 30
                ? item.password.substring(0, 30) + "..."
                : item.password
              const colorBase = isTopOne ? 'bg-red-500' : 'bg-orange-500'

              return (
                <div 
                  key={index} 
                  ref={(el) => { itemRefs.current[index] = el }}
                  className="group relative flex items-center py-1 pl-0 pr-2 rounded-lg transition-colors duration-500 hover:bg-white/5">
                  {/* Rank Number */}
                  <span className="w-8 text-xs font-mono text-muted-foreground text-center mr-2">
                    {index + 1}
                  </span>

                  {/* Progress Bar Container */}
                  <div className="flex-1 relative h-8 bg-background/60 rounded-md overflow-hidden border border-border/50 group-hover:border-border/70 transition-colors">
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
                      <span className="font-mono text-xs text-muted-foreground truncate z-10 max-w-[70%]">
                        {displayPassword}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground glass px-1.5 py-0.5 rounded border border-white/5 z-10">
                        {item.total_count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No password data available</p>
        )}
      </CardContent>
    </Card>
  )
}

