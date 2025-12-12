"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect } from "react"
import { TrendingUp, Globe, Key, ExternalLink, HardDrive, Link, Database, Monitor, Package } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import nextDynamic from "next/dynamic"

// Dynamic import for chart component to reduce initial bundle size
const BrowserVerticalBarChart = nextDynamic(
  () => import("@/components/browser-vertical-bar-chart"),
  {
    loading: () => <LoadingChart height={450} />,
    ssr: false // Charts often don't need SSR
  }
)
import { AuthGuard } from "@/components/auth-guard"
import { AnimatedStatCard } from "@/components/animated-stat-card"
import { AnimatedSoftwareList } from "@/components/animated-software-list"
import ErrorBoundary from "@/components/error-boundary"
import { LoadingState, LoadingChart, LoadingCard } from "@/components/ui/loading"

interface TopPassword {
  password: string
  total_count: number
}

interface TopTLD {
  tld: string
  count: number
}

interface RSSItem {
  title: string
  link: string
  pubDate: string
  description: string
}

interface BrowserData {
  browser: string
  count: number
}

interface SoftwareData {
  software_name: string
  version: string | null
  count: number
}

// Add stats interface
interface Stats {
  totalDevices: number
  uniqueDeviceNames: number
  duplicateDeviceNames: number
  totalFiles: number
  totalCredentials: number
  totalDomains: number
  totalUrls: number
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  )
}

function DashboardContent() {
  const [topPasswords, setTopPasswords] = useState<TopPassword[]>([])
  const [topTLDs, setTopTLDs] = useState<TopTLD[]>([])
  const [rssItems, setRssItems] = useState<RSSItem[]>([])
  const [ransomwareItems, setRansomwareItems] = useState<RSSItem[]>([])
  const [browserData, setBrowserData] = useState<BrowserData[]>([])
  const [softwareData, setSoftwareData] = useState<SoftwareData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({
    totalDevices: 0,
    uniqueDeviceNames: 0,
    duplicateDeviceNames: 0,
    totalFiles: 0,
    totalCredentials: 0,
    totalDomains: 0,
    totalUrls: 0,
  })

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      // Load all data in parallel for faster loading
      const [
        statsResponse,
        tldsResponse,
        rssResponse,
        ransomwareResponse,
        browserResponse,
        softwareResponse
      ] = await Promise.all([
        fetch("/api/stats"),
        fetch("/api/top-tlds"),
        fetch("/api/rss-feeds?source=malware-traffic"),
        fetch("/api/rss-feeds?source=ransomware-live"),
        fetch("/api/browser-analysis"),
        fetch("/api/software-analysis")
      ])

      // Process stats response (contains both stats and top passwords)
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData.stats)
        setTopPasswords(statsData.topPasswords || [])
      }

      // Process top TLDs response
      if (tldsResponse.ok) {
        const tldsData = await tldsResponse.json()
        console.log("📊 TLDs API Response:", tldsData)
        // Handle both possible response structures
        if (Array.isArray(tldsData)) {
          setTopTLDs(tldsData)
        } else if (tldsData.topTLDs && Array.isArray(tldsData.topTLDs)) {
          setTopTLDs(tldsData.topTLDs)
        } else {
          console.warn("Unexpected TLDs response structure:", tldsData)
          setTopTLDs([])
        }
      }

      // Process RSS feeds response
      if (rssResponse.ok) {
        const rssData = await rssResponse.json()
        console.log("📡 RSS API Response:", rssData)
        // Handle the response structure properly
        if (rssData.success && rssData.feed && rssData.feed.items) {
          setRssItems(rssData.feed.items.slice(0, 7))
        } else if (rssData.items) {
          setRssItems(rssData.items.slice(0, 7))
        } else {
          console.warn("Unexpected RSS response structure:", rssData)
          setRssItems([])
        }
      } else {
        console.error("RSS API failed:", rssResponse.status)
      }

      // Process Ransomware Live RSS feeds response
      if (ransomwareResponse.ok) {
        const ransomwareData = await ransomwareResponse.json()
        console.log("🔒 Ransomware RSS API Response:", ransomwareData)
        // Handle the response structure properly
        if (ransomwareData.success && ransomwareData.feed && ransomwareData.feed.items) {
          setRansomwareItems(ransomwareData.feed.items.slice(0, 7))
        } else if (ransomwareData.items) {
          setRansomwareItems(ransomwareData.items.slice(0, 7))
        } else {
          console.warn("Unexpected Ransomware RSS response structure:", ransomwareData)
          setRansomwareItems([])
        }
      } else {
        console.error("Ransomware RSS API failed:", ransomwareResponse.status)
      }

      // Process browser analysis response
      if (browserResponse.ok) {
        const browserData = await browserResponse.json()
        console.log("🌐 Browser Analysis API Response:", browserData)
        if (browserData.success && browserData.browserAnalysis) {
          setBrowserData(browserData.browserAnalysis)
        } else {
          console.warn("Unexpected browser analysis response structure:", browserData)
          setBrowserData([])
        }
      } else {
        console.error("Browser Analysis API failed:", browserResponse.status)
      }

      // Process software analysis response
      if (softwareResponse.ok) {
        const softwareData = await softwareResponse.json()
        console.log("📦 Software Analysis API Response:", softwareData)
        if (softwareData.success && softwareData.softwareAnalysis) {
          setSoftwareData(softwareData.softwareAnalysis)
        } else {
          console.warn("Unexpected software analysis response structure:", softwareData)
          setSoftwareData([])
        }
      } else {
        console.error("Software Analysis API failed:", softwareResponse.status)
      }
    } catch (error) {
      console.error("Failed to load dashboard data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "Unknown date"
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch (error) {
      return dateString
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-transparent">
        <main className="flex-1 p-6 bg-transparent">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Loading skeleton for stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LoadingCard />
              <LoadingCard />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <LoadingCard />
              <LoadingCard />
              <LoadingCard />
            </div>

            {/* Loading state for main content */}
            <LoadingState
              type="default"
              message="Loading dashboard statistics..."
              size="lg"
            />

            {/* Loading charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <LoadingChart height={400} />
              <LoadingChart height={400} />
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-transparent">
      <main className="flex-1 p-4 bg-transparent">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Statistic Boxes - Layer 1 */}
          <ErrorBoundary context="Dashboard Stats Layer 1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AnimatedStatCard
                icon={HardDrive}
                value={stats.totalDevices}
                label="Total Devices"
                iconColor="text-blue-500"
                delay={0}
              />
              <AnimatedStatCard
                icon={Key}
                value={stats.totalCredentials}
                label="Total Credentials"
                iconColor="text-emerald-500"
                delay={0.2}
              />
            </div>
          </ErrorBoundary>

          {/* Statistic Boxes - Layer 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <AnimatedStatCard
              icon={Database}
              value={stats.totalFiles}
              label="Files Extracted"
              iconColor="text-emerald-500"
              delay={0.4}
            />
            <AnimatedStatCard
              icon={Globe}
              value={stats.totalDomains}
              label="Total Domains"
              iconColor="text-blue-500"
              delay={0.6}
            />
            <AnimatedStatCard
              icon={Link}
              value={stats.totalUrls}
              label="Total URLs"
              iconColor="text-amber-500"
              delay={0.8}
            />
          </div>

          {/* Info Alerts */}
          {stats.totalFiles === 0 && (
            <Alert className="glass-card border-l-4 border-l-blue-500">
              <Database className="h-4 w-4 text-blue-500" />
              <AlertDescription className="text-foreground">
                No data found. Please upload a .zip file first using the Upload menu to populate the search database.
              </AlertDescription>
            </Alert>
          )}
          {/* Top Passwords */}
          <Card className="glass-card">
            <CardHeader className="!p-4 border-b border-white/5">
              <CardTitle className="flex items-center text-foreground text-lg">
                <Key className="h-4 w-4 mr-2 text-primary" />
                Top 5 Most Used Passwords
              </CardTitle>
            </CardHeader>
            <CardContent className="!p-4 pt-6">
              {topPasswords.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {topPasswords.map((passwordData, index) => (
                    <div key={index} className="text-center group">
                      <div className="glass text-base font-bold text-primary font-mono p-3 rounded-lg border border-white/5 group-hover:border-primary/50 group-hover:bg-primary/10 transition-all duration-300">
                        {passwordData.password.length > 15
                          ? passwordData.password.substring(0, 15) + "..."
                          : passwordData.password}
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 font-medium">
                        {Number(passwordData.total_count).toLocaleString()} times
                      </div>
                      <Badge
                        variant={index === 0 ? "default" : "secondary"}
                        className={
                          index === 0
                            ? "bg-primary text-primary-foreground mt-2"
                            : "bg-secondary text-secondary-foreground mt-2"
                        }
                      >
                        #{index + 1}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No password data available</p>
              )}
            </CardContent>
          </Card>

          {/* Top TLDs, Malware Traffic Analysis, and Ransomware Live - Responsive Flex Layout */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Top TLDs */}
            <Card className="flex-1 lg:basis-[2.5/12] glass-card">
              <CardHeader className="!p-4 border-b border-white/5">
                <CardTitle className="flex items-center text-foreground text-lg">
                  <Globe className="h-4 w-4 mr-2 text-blue-500" />
                  Top 10 TLDs
                </CardTitle>
              </CardHeader>
              <CardContent className="!p-4 pt-4 h-[490px] pr-2 flex flex-col"> {/* Updated height and added flex-col */}
                {topTLDs.length > 0 ? (
                  <ScrollArea className="h-full flex-grow"> {/* Make ScrollArea fill parent height and grow */}
                    <div className="space-y-2"> {/* Changed to space-y for vertical layout */}
                      {topTLDs.slice(0, 10).map((tldData, index) => (
                        <div key={index} className="flex items-center justify-between p-2 rounded-lg glass hover:border-primary/50 hover:bg-primary/10 transition-all duration-300">
                          <span className="text-sm font-bold text-blue-500">
                            #{index + 1}
                          </span>
                          <span className="text-sm font-mono text-foreground">
                            .{tldData.tld}
                          </span>
                          {/* Added pr-2 to balance spacing on the right */}
                          <span className="text-xs text-muted-foreground pr-2">
                            ({Number(tldData.count).toLocaleString()} domains)
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No TLD data available</p>
                    <p className="text-xs text-muted-foreground mt-2">Upload some stealer logs to see domain statistics</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Malware Traffic Analysis */}
            <Card className="flex-1 lg:basis-[4.75/12] glass-card">
              <CardHeader className="!p-4 border-b border-white/5">
                <CardTitle className="flex items-center text-foreground text-lg">
                  <TrendingUp className="h-4 w-4 mr-2 text-emerald-500" />
                  Malware Traffic Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="!p-4 pt-4 h-[490px] flex flex-col"> {/* Updated height and added flex-col */}
                {rssItems.length > 0 ? (
                  <ScrollArea className="h-full flex-grow"> {/* Make ScrollArea fill parent height and grow */}
                    <div className="space-y-3">
                      {rssItems.map((item, index) => (
                        <div key={index} className="border-b border-border/40 pb-3 last:border-b-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-sm font-medium text-foreground hover:text-blue-500 transition-colors">
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center"
                                >
                                  {item.title}
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </a>
                              </h3>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                              <p className="text-[10px] text-muted-foreground/70 mt-1">{formatDate(item.pubDate)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No RSS feed data available</p>
                    <p className="text-xs text-muted-foreground mt-2">Unable to fetch malware traffic analysis news</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Ransomware Cases */}
            <Card className="flex-1 lg:basis-[4.75/12] glass-card">
              <CardHeader className="!p-4 border-b border-white/5">
                <CardTitle className="flex items-center text-foreground text-lg">
                  <TrendingUp className="h-4 w-4 mr-2 text-primary" />
                  Recent Ransomware Cases
                </CardTitle>
              </CardHeader>
              <CardContent className="!p-4 pt-4 h-[490px] flex flex-col"> {/* Updated height and added flex-col */}
                {ransomwareItems.length > 0 ? (
                  <ScrollArea className="h-full flex-grow"> {/* Make ScrollArea fill parent height and grow */}
                    <div className="space-y-3">
                      {ransomwareItems.map((item, index) => (
                        <div key={index} className="border-b border-border/40 pb-3 last:border-b-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center"
                                >
                                  {item.title}
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </a>
                              </h3>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                              <p className="text-[10px] text-muted-foreground/70 mt-1">{formatDate(item.pubDate)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No RSS feed data available</p>
                    <p className="text-xs text-muted-foreground mt-2">Unable to fetch ransomware live news</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Browser Analysis and Software Analysis - Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Browser Analysis */}
            <Card className="col-span-1 lg:col-span-2 glass-card">
              <CardHeader className="!p-4 border-b border-white/5">
                <CardTitle className="flex items-center text-foreground text-lg">
                  <Monitor className="h-4 w-4 mr-2 text-violet-500" />
                  Top Browsers Used by Infected Devices
                </CardTitle>
              </CardHeader>
              <CardContent className="!p-4 pt-6">
                <div className="w-full h-[500px] flex items-end justify-center mt-4">
                  <ErrorBoundary
                    context="Browser Chart"
                    fallback={
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <p className="text-red-500 text-sm">Failed to load browser chart</p>
                          <p className="text-xs text-muted-foreground mt-1">Please try refreshing the page</p>
                        </div>
                      </div>
                    }
                  >
                    <BrowserVerticalBarChart browserData={browserData} height={450} />
                  </ErrorBoundary>
                </div>
              </CardContent>
            </Card>

            {/* Software Analysis */}
            <Card className="col-span-1 lg:col-span-2 glass-card">
              <CardHeader className="!p-4 border-b border-white/5">
                <CardTitle className="flex items-center text-foreground text-lg">
                  <Package className="h-4 w-4 mr-2 text-emerald-500" />
                  Most Common Software Found in Logs
                </CardTitle>
              </CardHeader>
              <CardContent className="!p-4 pt-6">
                <ErrorBoundary fallback={<div className="text-red-500 text-sm">Software list error</div>}>
                  <AnimatedSoftwareList softwareData={softwareData} />
                </ErrorBoundary>
              </CardContent>
            </Card>
          </div>

        </div>
      </main>
    </div>
  )
}
