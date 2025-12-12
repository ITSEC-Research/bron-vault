"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AuthGuard } from "@/components/auth-guard"
import { ReconSearchBar } from "@/components/recon/ReconSearchBar"

export default function DomainSearchPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleSearch = async (query: string, searchType: "domain" | "keyword", keywordMode?: "domain-only" | "full-url") => {
    if (!query || !query.trim()) return
    
    setIsLoading(true)
    
    if (searchType === 'domain') {
    // Normalize domain
      let normalizedDomain = query.trim().toLowerCase()
    normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '')
    normalizedDomain = normalizedDomain.replace(/^www\./, '')
    normalizedDomain = normalizedDomain.replace(/\/$/, '')
    normalizedDomain = normalizedDomain.split('/')[0].split(':')[0]
    
    // Navigate to domain page with overview tab
    router.push(`/domain-search/${encodeURIComponent(normalizedDomain)}?tab=overview`)
    } else {
      // Keyword search - pass as-is with type and mode parameters
      const modeParam = keywordMode && keywordMode !== 'full-url' ? `&mode=${keywordMode}` : ''
      router.push(`/domain-search/${encodeURIComponent(query.trim())}?type=keyword${modeParam}&tab=overview`)
    }
    
    setIsLoading(false)
  }

  return (
    <AuthGuard>
      <div className="flex flex-col min-h-screen bg-transparent">
        <main className="flex-1 p-6 bg-transparent">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Spacer to match TypingEffect height + spacing */}
            <div className="mt-8 h-8"></div>
            <ReconSearchBar
              onSearch={handleSearch}
              isLoading={isLoading}
            />
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}

