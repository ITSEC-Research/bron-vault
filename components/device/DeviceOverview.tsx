"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  RadialBarChart,
  RadialBar,
  Legend,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import {
  Key,
  Package,
  FileText,
  Calendar,
  Monitor,
  Globe,
  User,
  Cpu,
  HardDrive,
  MapPin,
  Server,
  Lock,
  BarChart3,
  Info,
  FolderOpen,
  FileType,
} from "lucide-react"
import { format } from "date-fns"
import { LoadingState } from "@/components/ui/loading"

interface OverviewData {
  summary: {
    totalCredentials: number
    totalSoftware: number
    totalFiles: number
    uploadDate: string | null
    uploadBatch: string | null
  }
  topPasswords: Array<{ password: string; count: number }>
  browserDistribution: Array<{ browser: string; count: number }>
  topDomains: Array<{ domain: string; count: number }>
  fileStatistics: {
    totalFiles: number
    bySize: Array<{ category: string; count: number }>
    totalDirectories: number
    totalTxtFiles: number
    totalOtherFiles: number
  }
  hostInfo: {
    os: string | null
    computerName: string | null
    ipAddress: string | null
    country: string | null
    username: string | null
    cpu: string | null
    ram: string | null
    gpu: string | null
  } | null
}

interface DeviceOverviewProps {
  deviceId: string
}

// Chart colors based on theme - 10 distinct colors for top 10 passwords
const CHART_COLORS = [
  "hsl(4, 100%, 45%)",      // 1. bron-accent-red (primary)
  "hsl(221, 83%, 53%)",    // 2. bron-accent-blue
  "hsl(158, 64%, 52%)",    // 3. green
  "hsl(32, 95%, 44%)",     // 4. yellow/orange
  "hsl(340, 75%, 55%)",    // 5. pink
  "hsl(200, 100%, 50%)",   // 6. cyan
  "hsl(270, 70%, 50%)",    // 7. purple
  "hsl(15, 90%, 50%)",     // 8. orange-red (distinct from #1)
  "hsl(180, 70%, 45%)",    // 9. teal (distinct from #6)
  "hsl(300, 70%, 50%)",    // 10. magenta (distinct from #5)
]

// Helper function to get country flag emoji from country code
function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) {
    return "🌍"
  }
  // Convert country code to flag emoji
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

export function DeviceOverview({ deviceId }: DeviceOverviewProps) {
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    const loadOverview = async () => {
      setIsLoading(true)
      setError("")

      try {
        const response = await fetch("/api/device-overview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ deviceId }),
        })

        if (response.ok) {
          const data = await response.json()
          console.log("Overview data loaded:", {
            summary: data.summary,
            topPasswords: data.topPasswords?.length || 0,
            browserDistribution: data.browserDistribution?.length || 0,
            topDomains: data.topDomains?.length || 0,
            fileStatistics: data.fileStatistics ? `${data.fileStatistics.totalFiles} files, ${data.fileStatistics.byType?.length || 0} types` : "null",
            hostInfo: data.hostInfo ? "exists" : "null"
          })
          setOverviewData(data)
        } else {
          const errorData = await response.json()
          console.error("API Error:", errorData)
          setError(errorData.error || errorData.details || "Failed to load overview")
        }
      } catch (error) {
        console.error("Failed to load overview:", error)
        setError(`Network Error: ${error instanceof Error ? error.message : "Unknown error"}`)
      } finally {
        setIsLoading(false)
      }
    }

    loadOverview()
  }, [deviceId])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-16">
          <LoadingState type="stats" message="Loading device overview..." size="md" />
        </div>
      </div>
    )
  }

  if (error || !overviewData) {
    return (
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Error Loading Overview</p>
            <p className="text-xs text-muted-foreground">{error || "No overview data available"}</p>
            {error && (
              <p className="text-xs text-muted-foreground mt-2">
                Please check the browser console for more details.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const { summary, topPasswords, browserDistribution: _browserDistribution, topDomains, fileStatistics, hostInfo } = overviewData

  // Format top passwords for chart (top 10) - Polar Area Chart style
  // In polar area chart, each segment has same angle but different radius
  // We'll use PieChart with custom styling to create polar area effect
  const maxValue = Math.max(...topPasswords.map((item) => item.count), 1)
  const minRadius = 50
  const maxRadius = 120
  const chartPasswords = topPasswords.slice(0, 10).map((item, index) => {
    // Normalize value to 0-1 range for polar area chart
    const normalizedValue = item.count / maxValue
    // Calculate radius based on value (for visual reference, not used in PieChart)
    const radius = minRadius + (maxRadius - minRadius) * normalizedValue
    return {
      name: item.password.length > 20 ? `${item.password.substring(0, 20)}...` : item.password,
      value: item.count,
      fullPassword: item.password,
      color: CHART_COLORS[index % CHART_COLORS.length],
      rank: index + 1,
      radius: radius, // For reference
    }
  })

  // Format file size distribution for chart - Static 6 categories (catch-all approach)
  // Always show all 6 categories regardless of data, ensuring consistent layout
  const staticCategories = [
    '< 1 KB',
    '1 KB - 10 KB',
    '10 KB - 100 KB',
    '100 KB - 1 MB',
    '1 MB - 10 MB',
    '> 10 MB' // Catch-all
  ]
  
  const fileSizeMap = new Map(
    (fileStatistics?.bySize || []).map((item: any) => [item.category, item.count])
  )
  
  const chartFileSizes = staticCategories.map((category, _index) => ({
    name: category,
    value: fileSizeMap.get(category) || 0, // Default to 0 if category doesn't exist in data
    color: "hsl(4, 100%, 45%)", // bron-accent-red - consistent color for all bars, matches Top Domains
  }))

  // Format top domains for Horizontal Bar Chart (limit to 7)
  // Use consistent color for all bars since ranking is already clear from position
  const chartDomains = (topDomains || []).slice(0, 7).map((item, _index) => ({
    name: item.domain && item.domain.length > 30 ? `${item.domain.substring(0, 30)}...` : (item.domain || "Unknown"),
    fullDomain: item.domain || "Unknown",
    value: item.count || 0,
    color: "hsl(4, 100%, 45%)", // bron-accent-red - consistent color for all bars, matches File Statistics
    rank: _index + 1,
  }))

  // Format upload date
  const formattedUploadDate = summary.uploadDate
    ? format(new Date(summary.uploadDate), "MMM dd, yyyy")
    : "N/A"

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card hover:border-primary/30 transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Credentials</p>
                <p className="text-2xl font-semibold text-foreground">
                  {summary.totalCredentials.toLocaleString()}
                </p>
              </div>
              <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center ring-1 ring-inset ring-primary/20">
                <Key className="h-8 w-8 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card hover:border-primary/30 transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Software</p>
                <p className="text-2xl font-semibold text-foreground">
                  {summary.totalSoftware.toLocaleString()}
                </p>
              </div>
              <div className="h-16 w-16 rounded-lg bg-blue-500/10 flex items-center justify-center ring-1 ring-inset ring-blue-500/20">
                <Package className="h-8 w-8 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card hover:border-primary/30 transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Files</p>
                <p className="text-2xl font-semibold text-foreground">
                  {summary.totalFiles.toLocaleString()}
                </p>
              </div>
              <div className="h-16 w-16 rounded-lg bg-emerald-500/10 flex items-center justify-center ring-1 ring-inset ring-emerald-500/20">
                <FileText className="h-8 w-8 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card hover:border-primary/30 transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Upload Date</p>
                <p className="text-lg font-semibold text-foreground">{formattedUploadDate}</p>
              </div>
              <div className="h-16 w-16 rounded-lg bg-amber-500/10 flex items-center justify-center ring-1 ring-inset ring-amber-500/20">
                <Calendar className="h-8 w-8 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Host Info & Top Passwords */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Device Overview Card */}
        <Card className="glass-card">
          <CardHeader className="pb-3 pt-4 px-4 border-b border-white/5">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Info className="h-4 w-4" />
              Device Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-4">
            {hostInfo ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Monitor className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Operating System</p>
                    <p className="text-xs text-foreground truncate mt-1">{hostInfo.os || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Server className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Computer Name</p>
                    <p className="text-xs text-foreground truncate mt-1">{hostInfo.computerName || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Username</p>
                    <p className="text-xs text-foreground truncate mt-1">{hostInfo.username || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">IP Address</p>
                    <p className="text-xs text-foreground truncate mt-1">{hostInfo.ipAddress || "N/A"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Country</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {hostInfo.country ? (
                        <>
                          <span className="text-base leading-none">{getCountryFlag(hostInfo.country)}</span>
                          <p className="text-xs text-foreground truncate">{hostInfo.country}</p>
                        </>
                      ) : (
                        <p className="text-xs text-foreground">N/A</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">CPU</p>
                      <p className="text-xs text-foreground truncate mt-1">{hostInfo.cpu || "N/A"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">RAM</p>
                      <p className="text-xs text-foreground truncate mt-1">{hostInfo.ram || "N/A"}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  <Monitor className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">GPU</p>
                    <p className="text-xs text-foreground truncate mt-1">{hostInfo.gpu || "N/A"}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No host information available</p>
            )}
          </CardContent>
        </Card>

        {/* Top Passwords Polar Area Chart */}
        <Card className="glass-card">
          <CardHeader className="pb-4 pt-3 px-4 border-b border-white/5">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Top Passwords
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-1">
            {chartPasswords.length > 0 ? (
              <div className="h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="38%"
                    innerRadius="20%"
                    outerRadius="80%"
                    data={chartPasswords}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <RadialBar
                      dataKey="value"
                      cornerRadius={6}
                      minPointSize={15}
                      background={{ fill: "hsl(var(--secondary))", opacity: 0.3 }}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                      isAnimationActive={true}
                      animationDuration={800}
                      animationEasing="ease-out"
                    >
                      {chartPasswords.map((entry, index) => {
                        // Convert HSL to HSLA with opacity for softer appearance
                        const colorWithOpacity = entry.color.replace('hsl(', 'hsla(').replace(')', ', 0.75)')
                        return (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={colorWithOpacity}
                            stroke="hsl(var(--background))"
                            strokeWidth={2}
                            style={{
                              cursor: 'pointer'
                            }}
                          />
                        )
                      })}
                    </RadialBar>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) {
                          return null
                        }
                        const data = payload[0]
                        const value = data.value as number
                        
                        // RadialBarChart passes the full data object in payload.payload
                        // This should contain the complete entry from chartPasswords array
                        const payloadData = (data as any).payload
                        
                        // First, try to use data directly from payload (most reliable)
                        // The payload should contain the full entry from chartPasswords array
                        let entry = payloadData && payloadData.rank ? payloadData : null
                        
                        // If payload doesn't have rank, try to find by matching value + name
                        if (!entry || !entry.rank) {
                          if (payloadData?.name) {
                            entry = chartPasswords.find((item) => 
                              item.value === value && 
                              (item.name === payloadData.name || item.fullPassword === payloadData.name)
                            )
                          }
                        }
                        
                        // If still not found, try to find by index
                        // RadialBarChart might pass index in the payload
                        if (!entry || !entry.rank) {
                          // Check if payload has index property
                          const payloadIndex = payloadData?.index ?? (data as any).index
                          if (payloadIndex !== undefined && payloadIndex !== null && 
                              payloadIndex >= 0 && payloadIndex < chartPasswords.length) {
                            entry = chartPasswords[payloadIndex]
                          }
                        }
                        
                        // If still not found, try to find by matching name only
                        if (!entry || !entry.rank) {
                          if (payloadData?.name) {
                            entry = chartPasswords.find((item) => 
                              item.name === payloadData.name || item.fullPassword === payloadData.name
                            )
                          }
                        }
                        
                        // Last resort: find all entries with same value
                        // If multiple entries have same value, try to match by name first
                        if (!entry || !entry.rank) {
                          const matchingEntries = chartPasswords.filter((item) => item.value === value)
                          if (matchingEntries.length > 0) {
                            if (payloadData?.name) {
                              // Try to match by name if available
                              entry = matchingEntries.find((item) => 
                                item.name === payloadData.name || item.fullPassword === payloadData.name
                              ) || matchingEntries[0]
                            } else {
                              // If no name match, use first entry (this might be wrong if multiple have same value)
                              entry = matchingEntries[0]
                            }
                          }
                        }
                        
                        // Final fallback: construct entry from available data
                        if (!entry || !entry.rank) {
                          entry = {
                            rank: payloadData?.rank || "?",
                            fullPassword: payloadData?.fullPassword || payloadData?.name || "Unknown",
                            name: payloadData?.name || "Unknown",
                            value: value,
                          } as any
                        }
                        
                        const password = entry?.fullPassword || entry?.name || payloadData?.name || "Unknown"
                        const rank = entry?.rank || "?"
                        
                        return (
                          <div
                            style={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                              color: "hsl(var(--foreground))",
                              fontSize: "12px",
                              padding: "8px 12px",
                              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                              backdropFilter: "blur(8px)",
                            }}
                          >
                            <div style={{ color: "hsl(var(--foreground))", fontWeight: "500", marginBottom: "4px" }}>
                              #{rank} - {password}
                            </div>
                            <div style={{ color: "hsl(var(--muted-foreground))", fontSize: "11px" }}>
                              {value} occurrence{value > 1 ? "s" : ""}
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginTop: "32px", paddingTop: "20px", borderTop: "1px solid hsl(var(--border))" }}
                      formatter={(value, entry: any) => {
                        if (!entry || !entry.payload) {
                          return value || "Unknown"
                        }
                        const data = entry.payload
                        const rank = data?.rank || "?"
                        const password = data?.fullPassword || data?.name || value || "Unknown"
                        return `#${rank} - ${password}`
                      }}
                      iconType="circle"
                      iconSize={10}
                    />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-xs text-muted-foreground">No password data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Top Domains & File Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Domains - Custom Bar Style (matching domain-search) */}
        <Card className="glass-card h-full flex flex-col">
          <CardHeader className="!p-4 border-b border-white/5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-foreground text-lg">
                <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                Top Domains
              </CardTitle>
              <span className="text-xs text-muted-foreground">Top 7 by Volume</span>
            </div>
          </CardHeader>
          <CardContent className="!pl-2 !pr-3 !pb-3 !pt-3 flex-1 overflow-auto">
            {chartDomains.length > 0 ? (
              <div className="space-y-2">
                {chartDomains.map((item, index) => {
                  const maxVal = Math.max(...chartDomains.map(d => d.value))
                  const widthPercent = maxVal > 0 ? (item.value / maxVal) * 100 : 0
                  const displayDomain = item.fullDomain || item.name || "Unknown"
                  const isTruncated = displayDomain.length > 50

                  return (
                    <div 
                      key={index} 
                      className="group relative flex items-center py-1 pl-0 pr-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      {/* Rank Number */}
                      <span className="w-8 text-xs font-mono text-muted-foreground text-center mr-2">
                        {item.rank}
                      </span>

                      {/* Progress Bar Container */}
                      <div className="flex-1 relative h-8 bg-secondary/30 rounded-md overflow-hidden border border-border/50 group-hover:border-border/70 transition-colors">
                        {/* Background Progress Bar - Gradient Effect */}
                        <div
                          className="absolute top-0 left-0 h-full bg-red-500 opacity-10 group-hover:opacity-20 transition-all duration-500"
                          style={{ width: `${widthPercent}%` }}
                        />
                        {/* Bottom accent line for progress */}
                        <div
                          className="absolute bottom-0 left-0 h-[2px] bg-red-500 opacity-60 group-hover:opacity-100 transition-all duration-500"
                          style={{ width: `${widthPercent}%` }}
                        />
                        {/* Content inside the bar */}
                        <div className="absolute inset-0 flex items-center justify-between px-3">
                          <span 
                            className="font-mono text-xs text-foreground truncate z-10 max-w-[70%]"
                            title={isTruncated ? displayDomain : undefined}
                          >
                            {displayDomain}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded border border-white/5 z-10">
                            {item.value.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Tooltip for long domains - appears above */}
                      {isTruncated && (
                        <div className="absolute left-0 bottom-full mb-1 z-50 hidden group-hover:block pointer-events-none">
                          <div className="glass-card rounded-md px-3 py-2 shadow-lg max-w-md">
                            <p className="text-xs text-foreground font-mono break-all">
                              {displayDomain}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {item.value} URL{item.value > 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="h-[380px] flex items-center justify-center">
                <p className="text-xs text-muted-foreground">No domain data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* File Size Distribution - Custom Bar Style (matching domain-search) */}
        <Card className="glass-card h-full flex flex-col">
          <CardHeader className="!p-4 border-b border-white/5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-foreground text-lg">
                <BarChart3 className="h-4 w-4 mr-2 text-muted-foreground" />
                File Size Distribution
              </CardTitle>
              <span className="text-xs text-muted-foreground">By Category</span>
            </div>
          </CardHeader>
          <CardContent className="!p-0 flex flex-col flex-1 min-h-0">
            <div className="!pl-2 !pr-3 !pb-3 !pt-3 flex-1 overflow-auto">
              {chartFileSizes.length > 0 ? (
                <div className="space-y-2">
                  {chartFileSizes.map((item, index) => {
                    const maxVal = Math.max(...chartFileSizes.map(d => d.value), 1) // Ensure at least 1 to avoid division by zero
                    const widthPercent = maxVal > 0 ? (item.value / maxVal) * 100 : 0
                    const displayCategory = item.name || "Unknown"

                    return (
                      <div 
                        key={index} 
                      className="group relative flex items-center py-1 pl-0 pr-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                        {/* Rank/Index Number */}
                        <span className="w-8 text-xs font-mono text-muted-foreground text-center mr-2">
                          {index + 1}
                        </span>

                        {/* Progress Bar Container */}
                        <div className="flex-1 relative h-8 bg-secondary/30 rounded-md overflow-hidden border border-border/50 group-hover:border-border/70 transition-colors">
                          {/* Background Progress Bar - Gradient Effect */}
                          <div
                            className="absolute top-0 left-0 h-full bg-red-500 opacity-10 group-hover:opacity-20 transition-all duration-500"
                            style={{ width: `${widthPercent}%` }}
                          />
                          {/* Bottom accent line for progress */}
                          <div
                            className="absolute bottom-0 left-0 h-[2px] bg-red-500 opacity-60 group-hover:opacity-100 transition-all duration-500"
                            style={{ width: `${widthPercent}%` }}
                          />
                          {/* Content inside the bar */}
                          <div className="absolute inset-0 flex items-center justify-between px-3">
                            <span className="font-mono text-xs text-foreground truncate z-10 max-w-[70%]">
                              {displayCategory}
                            </span>
                            <span className="text-[10px] font-bold text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded border border-white/5 z-10">
                              {item.value.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="h-[320px] flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">No file data available</p>
                </div>
              )}
            </div>
            {/* Summary info below chart - always visible */}
            {(fileStatistics?.totalDirectories > 0 || fileStatistics?.totalTxtFiles > 0 || fileStatistics?.totalOtherFiles > 0) && (
              <div className="flex items-center gap-4 px-4 py-3 mt-auto border-t border-border/50 bg-secondary/20">
                {fileStatistics.totalDirectories > 0 && (
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-foreground">
                      {fileStatistics.totalDirectories.toLocaleString()} director{fileStatistics.totalDirectories > 1 ? "ies" : "y"}
                    </span>
                  </div>
                )}
                {fileStatistics.totalTxtFiles > 0 && (
                  <div className="flex items-center gap-2">
                    <FileType className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-foreground">
                      {fileStatistics.totalTxtFiles.toLocaleString()} .txt file{fileStatistics.totalTxtFiles > 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                {fileStatistics.totalOtherFiles > 0 && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-foreground">
                      {fileStatistics.totalOtherFiles.toLocaleString()} other file{fileStatistics.totalOtherFiles > 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

