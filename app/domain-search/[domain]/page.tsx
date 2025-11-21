"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { LayoutDashboard, Globe, Key } from "lucide-react"
import { AuthGuard } from "@/components/auth-guard"
import { ReconSearchBar } from "@/components/recon/ReconSearchBar"
import { ReconSummaryCards } from "@/components/recon/ReconSummaryCards"
import { OverviewTab } from "@/components/recon/OverviewTab"
import { SubdomainsTab } from "@/components/recon/SubdomainsTab"
import { CredentialsTab } from "@/components/recon/CredentialsTab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface SummaryStats {
  totalSubdomains: number
  totalPaths: number
  totalCredentials: number
  totalReusedCredentials: number
  totalDevices: number
}

export default function DomainSearchPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const domain = decodeURIComponent(params.domain as string)
  
  // Use local state for tab to make switching instant, sync with URL for bookmarking
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') || 'overview')

  // Sync state with URL when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') || 'overview'
    if (tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl)
    }
  }, [searchParams])

  const handleSearch = async (newDomain: string) => {
    if (!newDomain || !newDomain.trim()) return
    
    let normalizedDomain = newDomain.trim().toLowerCase()
    normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '')
    normalizedDomain = normalizedDomain.replace(/^www\./, '')
    normalizedDomain = normalizedDomain.replace(/\/$/, '')
    normalizedDomain = normalizedDomain.split('/')[0].split(':')[0]
    
    router.push(`/domain-search/${encodeURIComponent(normalizedDomain)}?tab=overview`)
  }

  const handleClear = () => {
    router.push('/domain-search')
  }

  const handleTabChange = (tab: string) => {
    // Update state immediately for instant UI response (no delay)
    setActiveTab(tab)
    // Update URL asynchronously for bookmarking (non-blocking)
    const newUrl = `/domain-search/${encodeURIComponent(domain)}?tab=${tab}`
    // Use startTransition to make URL update non-blocking
    router.replace(newUrl, { scroll: false })
  }

  return (
    <AuthGuard>
      <div className="flex flex-col min-h-screen bg-bron-bg-primary">
        <main className="flex-1 p-4 bg-bron-bg-primary">
          <div className="max-w-7xl mx-auto space-y-4">
            <ReconSearchBar
              onSearch={handleSearch}
              isLoading={false}
              targetDomain={domain}
              onClear={handleClear}
            />
            <DomainContent domain={domain} activeTab={activeTab} onTabChange={handleTabChange} />
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}

function DomainContent({ 
  domain, 
  activeTab, 
  onTabChange 
}: { 
  domain: string
  activeTab: string
  onTabChange: (tab: string) => void 
}) {
  const [summary, setSummary] = useState<SummaryStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSummary()
  }, [domain])

  const loadSummary = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/domain-recon/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDomain: domain }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setSummary(data.summary)
        }
      }
    } catch (error) {
      console.error("Error loading summary:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {summary && <ReconSummaryCards stats={summary} />}
      
      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
        <TabsList className="items-center justify-center rounded-md p-1 text-muted-foreground grid w-full grid-cols-3 bg-bron-bg-tertiary border border-bron-border h-8">
          <TabsTrigger
            value="overview"
            className="text-xs font-normal data-[state=active]:bg-bron-accent-red data-[state=active]:text-white px-2 py-1"
          >
            <LayoutDashboard className="h-3 w-3 mr-1" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="subdomains"
            className="text-xs font-normal data-[state=active]:bg-bron-accent-red data-[state=active]:text-white px-2 py-1"
          >
            <Globe className="h-3 w-3 mr-1" />
            Subdomains
          </TabsTrigger>
          <TabsTrigger
            value="credentials"
            className="text-xs font-normal data-[state=active]:bg-bron-accent-red data-[state=active]:text-white px-2 py-1"
          >
            <Key className="h-3 w-3 mr-1" />
            Credentials
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab targetDomain={domain} />
        </TabsContent>

        <TabsContent value="subdomains" className="mt-4">
          <SubdomainsTab targetDomain={domain} />
        </TabsContent>

        <TabsContent value="credentials" className="mt-4">
          <CredentialsTab targetDomain={domain} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

