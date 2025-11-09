"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Bar,
  Pie,
  PieChart,
  BarChart,
  RadialBarChart,
  RadialBar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  XAxis,
  YAxis,
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
  Folder,
  BarChart3,
  Info,
  FolderOpen,
  FileType,
} from "lucide-react"
import { format } from "date-fns"

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="bg-bron-bg-tertiary border-bron-border animate-pulse">
              <CardContent className="p-4">
                <div className="h-16 bg-bron-bg-secondary rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error || !overviewData) {
    return (
      <Card className="bg-bron-bg-tertiary border-bron-border">
        <CardContent className="p-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-bron-text-primary">Error Loading Overview</p>
            <p className="text-xs text-bron-text-muted">{error || "No overview data available"}</p>
            {error && (
              <p className="text-xs text-bron-text-muted mt-2">
                Please check the browser console for more details.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const { summary, topPasswords, browserDistribution, topDomains, fileStatistics, hostInfo } = overviewData

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

  // Format file size distribution for chart
  // Use consistent color for all bars since category is already clear from position
  const chartFileSizes = (fileStatistics?.bySize || []).map((item, index) => ({
    name: item.category,
    value: item.count,
    color: "hsl(4, 100%, 45%)", // bron-accent-red - consistent color for all bars, matches Top Domains
  }))

  // Format top domains for Horizontal Bar Chart (limit to 8)
  // Use consistent color for all bars since ranking is already clear from position
  const chartDomains = (topDomains || []).slice(0, 8).map((item, index) => ({
    name: item.domain && item.domain.length > 30 ? `${item.domain.substring(0, 30)}...` : (item.domain || "Unknown"),
    fullDomain: item.domain || "Unknown",
    value: item.count || 0,
    color: "hsl(4, 100%, 45%)", // bron-accent-red - consistent color for all bars, matches File Statistics
    rank: index + 1,
  }))

  // Format upload date
  const formattedUploadDate = summary.uploadDate
    ? format(new Date(summary.uploadDate), "MMM dd, yyyy")
    : "N/A"

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-bron-bg-tertiary border-bron-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-bron-text-muted mb-1">Total Credentials</p>
                <p className="text-2xl font-semibold text-bron-text-primary">
                  {summary.totalCredentials.toLocaleString()}
                </p>
              </div>
              <div className="h-16 w-16 rounded-lg bg-bron-accent-red/10 flex items-center justify-center">
                <Key className="h-8 w-8 text-bron-accent-red" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-bron-bg-tertiary border-bron-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-bron-text-muted mb-1">Total Software</p>
                <p className="text-2xl font-semibold text-bron-text-primary">
                  {summary.totalSoftware.toLocaleString()}
                </p>
              </div>
              <div className="h-16 w-16 rounded-lg bg-bron-accent-blue/10 flex items-center justify-center">
                <Package className="h-8 w-8 text-bron-accent-blue" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-bron-bg-tertiary border-bron-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-bron-text-muted mb-1">Total Files</p>
                <p className="text-2xl font-semibold text-bron-text-primary">
                  {summary.totalFiles.toLocaleString()}
                </p>
              </div>
              <div className="h-16 w-16 rounded-lg bg-bron-accent-green/10 flex items-center justify-center">
                <FileText className="h-8 w-8 text-bron-accent-green" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-bron-bg-tertiary border-bron-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-bron-text-muted mb-1">Upload Date</p>
                <p className="text-lg font-semibold text-bron-text-primary">{formattedUploadDate}</p>
              </div>
              <div className="h-16 w-16 rounded-lg bg-bron-accent-yellow/10 flex items-center justify-center">
                <Calendar className="h-8 w-8 text-bron-accent-yellow" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Host Info & Top Passwords */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Device Overview Card */}
        <Card className="bg-bron-bg-tertiary border-bron-border">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-bron-text-primary flex items-center gap-2">
              <Info className="h-4 w-4" />
              Device Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {hostInfo ? (
              <div className="space-y-3">
                {hostInfo.os && (
                  <div className="flex items-center gap-2">
                    <Monitor className="h-3.5 w-3.5 text-bron-text-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-bron-text-muted">Operating System</p>
                      <p className="text-xs text-bron-text-primary truncate mt-1">{hostInfo.os}</p>
                    </div>
                  </div>
                )}
                {hostInfo.computerName && (
                  <div className="flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-bron-text-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-bron-text-muted">Computer Name</p>
                      <p className="text-xs text-bron-text-primary truncate mt-1">{hostInfo.computerName}</p>
                    </div>
                  </div>
                )}
                {hostInfo.username && (
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-bron-text-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-bron-text-muted">Username</p>
                      <p className="text-xs text-bron-text-primary truncate mt-1">{hostInfo.username}</p>
                    </div>
                  </div>
                )}
                {hostInfo.ipAddress && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-bron-text-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-bron-text-muted">IP Address</p>
                      <p className="text-xs text-bron-text-primary truncate mt-1">{hostInfo.ipAddress}</p>
                    </div>
                  </div>
                )}
                {hostInfo.country && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-bron-text-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-bron-text-muted">Country</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-base leading-none">{getCountryFlag(hostInfo.country)}</span>
                        <p className="text-xs text-bron-text-primary truncate">{hostInfo.country}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-bron-border">
                  {hostInfo.cpu && (
                    <div className="flex items-center gap-2">
                      <Cpu className="h-3.5 w-3.5 text-bron-text-muted flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-bron-text-muted">CPU</p>
                        <p className="text-xs text-bron-text-primary truncate mt-1">{hostInfo.cpu}</p>
                      </div>
                    </div>
                  )}
                  {hostInfo.ram && (
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-3.5 w-3.5 text-bron-text-muted flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-bron-text-muted">RAM</p>
                        <p className="text-xs text-bron-text-primary truncate mt-1">{hostInfo.ram}</p>
                      </div>
                    </div>
                  )}
                </div>
                {hostInfo.gpu && (
                  <div className="flex items-center gap-2 pt-2 border-t border-bron-border">
                    <Monitor className="h-3.5 w-3.5 text-bron-text-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-bron-text-muted">GPU</p>
                      <p className="text-xs text-bron-text-primary truncate mt-1">{hostInfo.gpu}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-bron-text-muted">No host information available</p>
            )}
          </CardContent>
        </Card>

        {/* Top Passwords Polar Area Chart */}
        <Card className="bg-bron-bg-tertiary border-bron-border">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-sm font-semibold text-bron-text-primary flex items-center gap-2">
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
                      nameKey="name"
                      cornerRadius={6}
                      minPointSize={15}
                      background={{ fill: "var(--bron-bg-secondary)", opacity: 0.3 }}
                    >
                      {chartPasswords.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                          style={{
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer'
                          }}
                        />
                      ))}
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
                              backgroundColor: "var(--bron-bg-tertiary)",
                              border: "1px solid var(--bron-border)",
                              borderRadius: "6px",
                              color: "var(--bron-text-primary)",
                              fontSize: "12px",
                              padding: "8px 12px",
                              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                            }}
                          >
                            <div style={{ color: "var(--bron-text-primary)", fontWeight: "500", marginBottom: "4px" }}>
                              #{rank} - {password}
                            </div>
                            <div style={{ color: "var(--bron-text-secondary)", fontSize: "11px" }}>
                              {value} occurrence{value > 1 ? "s" : ""}
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "11px", color: "var(--bron-text-secondary)", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--bron-border)" }}
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
                <p className="text-xs text-bron-text-muted">No password data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Top Domains & File Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Domains Horizontal Bar Chart */}
        <Card className="bg-bron-bg-tertiary border-bron-border">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-bron-text-primary flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Top Domains
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {chartDomains.length > 0 ? (
              <div className="h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartDomains}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                  >
                    <XAxis 
                      type="number" 
                      tick={{ fill: "var(--bron-text-muted)", fontSize: 11 }}
                      axisLine={{ stroke: "var(--bron-border)", strokeOpacity: 0.3 }}
                      tickLine={{ stroke: "var(--bron-border)", strokeOpacity: 0.3 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fill: "var(--bron-text-secondary)", fontSize: 11, fontWeight: 500 }}
                      axisLine={{ stroke: "var(--bron-border)", strokeOpacity: 0.3 }}
                      tickLine={{ stroke: "var(--bron-border)", strokeOpacity: 0.3 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) {
                          return null
                        }
                        const data = payload[0]
                        const value = data.value as number
                        const payloadData = (data as any).payload || data
                        const domain = payloadData?.fullDomain || payloadData?.name || "Unknown"
                        const rank = payloadData?.rank || "?"
                        
                        return (
                          <div
                            style={{
                              backgroundColor: "var(--bron-bg-tertiary)",
                              border: "1px solid var(--bron-border)",
                              borderRadius: "6px",
                              color: "var(--bron-text-primary)",
                              fontSize: "12px",
                              padding: "8px 12px",
                              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                            }}
                          >
                            <div style={{ color: "var(--bron-text-primary)", fontWeight: "500", marginBottom: "4px" }}>
                              #{rank} - {domain}
                            </div>
                            <div style={{ color: "var(--bron-text-secondary)", fontSize: "11px" }}>
                              {value} URL{value > 1 ? "s" : ""}
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Bar
                      dataKey="value"
                      radius={[0, 6, 6, 0]}
                    >
                      {chartDomains.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          style={{
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer'
                          }}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[380px] flex items-center justify-center">
                <p className="text-xs text-bron-text-muted">No domain data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* File Size Distribution Horizontal Bar Chart */}
        <Card className="bg-bron-bg-tertiary border-bron-border">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-bron-text-primary flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              File Size Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {chartFileSizes.length > 0 ? (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartFileSizes}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                  >
                    <XAxis 
                      type="number" 
                      tick={{ fill: "var(--bron-text-muted)", fontSize: 11 }}
                      axisLine={{ stroke: "var(--bron-border)", strokeOpacity: 0.3 }}
                      tickLine={{ stroke: "var(--bron-border)", strokeOpacity: 0.3 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fill: "var(--bron-text-secondary)", fontSize: 11, fontWeight: 500 }}
                      axisLine={{ stroke: "var(--bron-border)", strokeOpacity: 0.3 }}
                      tickLine={{ stroke: "var(--bron-border)", strokeOpacity: 0.3 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) {
                          return null
                        }
                        const data = payload[0]
                        const value = data.value as number
                        const payloadData = (data as any).payload || data
                        const category = payloadData?.name || "Unknown"
                        
                        return (
                          <div
                            style={{
                              backgroundColor: "var(--bron-bg-tertiary)",
                              border: "1px solid var(--bron-border)",
                              borderRadius: "6px",
                              color: "var(--bron-text-primary)",
                              fontSize: "12px",
                              padding: "8px 12px",
                              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                            }}
                          >
                            <div style={{ color: "var(--bron-text-primary)", fontWeight: "500", marginBottom: "4px" }}>
                              {category}
                            </div>
                            <div style={{ color: "var(--bron-text-secondary)", fontSize: "11px" }}>
                              {value} file{value > 1 ? "s" : ""}
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Bar
                      dataKey="value"
                      radius={[0, 6, 6, 0]}
                    >
                      {chartFileSizes.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          style={{
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer'
                          }}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[320px] flex items-center justify-center">
                <p className="text-xs text-bron-text-muted">No file data available</p>
              </div>
            )}
            {/* Summary info below chart */}
            {(fileStatistics?.totalDirectories > 0 || fileStatistics?.totalTxtFiles > 0 || fileStatistics?.totalOtherFiles > 0) && (
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-bron-border">
                {fileStatistics.totalDirectories > 0 && (
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-bron-text-muted" />
                    <span className="text-xs text-bron-text-secondary">
                      {fileStatistics.totalDirectories.toLocaleString()} director{fileStatistics.totalDirectories > 1 ? "ies" : "y"}
                    </span>
                  </div>
                )}
                {fileStatistics.totalTxtFiles > 0 && (
                  <div className="flex items-center gap-2">
                    <FileType className="h-4 w-4 text-bron-text-muted" />
                    <span className="text-xs text-bron-text-secondary">
                      {fileStatistics.totalTxtFiles.toLocaleString()} .txt file{fileStatistics.totalTxtFiles > 1 ? "s" : ""}
                    </span>
                  </div>
                )}
                {fileStatistics.totalOtherFiles > 0 && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-bron-text-muted" />
                    <span className="text-xs text-bron-text-secondary">
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

