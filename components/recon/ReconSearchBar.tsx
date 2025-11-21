"use client"

import React, { useState } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

interface ReconSearchBarProps {
  onSearch: (domain: string) => void
  isLoading: boolean
  targetDomain?: string
  onClear?: () => void
}

export function ReconSearchBar({
  onSearch,
  isLoading,
  targetDomain,
  onClear,
}: ReconSearchBarProps) {
  const [domain, setDomain] = useState(targetDomain || "")

  const handleSearch = () => {
    if (domain.trim()) {
      onSearch(domain.trim())
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && domain.trim()) {
      handleSearch()
    }
  }

  // If targetDomain is provided, show compact version
  if (targetDomain) {
    return (
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-bron-text-muted">Target:</span>
          <span className="text-sm font-medium text-bron-text-primary">{targetDomain}</span>
        </div>
        {onClear && (
          <Button
            onClick={onClear}
            variant="outline"
            size="sm"
            className="bg-bron-bg-tertiary border-bron-border text-bron-text-primary hover:bg-bron-bg-secondary"
          >
            Clear
          </Button>
        )}
      </div>
    )
  }

  // Initial state - centered search
  return (
    <div className="flex flex-col items-center space-y-4">
      <Card className="bg-bron-bg-tertiary border-bron-border w-full max-w-3xl mx-auto">
        <CardContent className="p-6">
          <div className="flex flex-col items-center space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-bron-text-primary mb-2">
                Domain Search
              </h1>
              <p className="text-sm text-bron-text-muted">
                Enter a domain to explore its footprint
              </p>
            </div>
            <div className="flex items-center space-x-2 w-full">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-bron-text-muted h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Enter domain (e.g., example.com)"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10 h-12 text-lg bg-bron-bg-tertiary border-bron-border text-bron-text-primary placeholder:text-bron-text-muted"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={isLoading || !domain.trim()}
                className="h-12 px-6 bg-bron-accent-red hover:bg-bron-accent-red-hover text-white"
              >
                {isLoading ? "Searching..." : "Search"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

