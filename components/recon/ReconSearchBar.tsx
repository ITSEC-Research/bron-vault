"use client"

import React, { useState, useEffect, useRef } from "react"
import { Search, Globe, Key, Link, Globe2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface ReconSearchBarProps {
  onSearch: (query: string, searchType: "domain" | "keyword", keywordMode?: "domain-only" | "full-url") => void
  isLoading: boolean
  targetDomain?: string
  keywordMode?: "domain-only" | "full-url"
  onClear?: () => void
}

export function ReconSearchBar({
  onSearch,
  isLoading,
  targetDomain,
  keywordMode: initialKeywordMode,
  onClear,
}: ReconSearchBarProps) {
  const [query, setQuery] = useState(targetDomain || "")
  const [searchType, setSearchType] = useState<"domain" | "keyword">("domain")
  const [keywordMode, setKeywordMode] = useState<"domain-only" | "full-url">(initialKeywordMode || "full-url")
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync keywordMode from props (when navigating from URL)
  useEffect(() => {
    if (initialKeywordMode) {
      setKeywordMode(initialKeywordMode)
    }
  }, [initialKeywordMode])

  const detectSearchType = (input: string) => {
    const trimmed = input.trim()
    // Improved domain detection: valid domain format
    const domainRegex = /^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/
    
    if (trimmed.length > 0 && domainRegex.test(trimmed)) {
      setSearchType('domain')
    } else if (trimmed.length > 0) {
      setSearchType('keyword')
    } else {
      setSearchType('domain') // Default
    }
  }

  const handleSearch = () => {
    if (query.trim()) {
      onSearch(query.trim(), searchType, searchType === 'keyword' ? keywordMode : undefined)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      handleSearch()
    }
  }

  const handleModeChange = (mode: 'domain-only' | 'full-url') => {
    setKeywordMode(mode)
    // Refocus input after mode change so user can press Enter immediately
    setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
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
                Discover Subdomains and Paths Across Logs
              </h1>
              <p className="text-sm text-bron-text-muted">
                Enter a <span className="text-bron-accent-blue font-medium">domain</span> or <span className="text-bron-accent-red font-medium">keyword</span> to explore its footprint
              </p>
            </div>
            {/* Main Search Component with Enhanced UI */}
            <div className="relative group w-full">
              <div
                className="flex items-center w-full rounded-lg border border-bron-border bg-bron-bg-tertiary transition-all duration-200 shadow-sm"
              >
                {/* Left Icon - Auto-detect Indicator */}
                <div className="pl-4 pr-3 flex items-center justify-center pointer-events-none">
                  {searchType === 'domain' ? (
                    <Globe className="w-5 h-5 text-bron-accent-blue transition-all duration-300" />
                  ) : (
                    <Key className="w-5 h-5 text-bron-accent-red transition-all duration-300" />
                  )}
                </div>

                {/* Input Field */}
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    detectSearchType(e.target.value)
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder="example.com or keyword..."
                  className="flex-1 bg-transparent border-none outline-none h-14 text-lg text-bron-text-primary placeholder:text-bron-text-muted min-w-0"
                />

                {/* Scope Selector - Segmented Control (only when keyword mode) */}
                {searchType === 'keyword' && (
                  <div className="flex items-center bg-bron-bg-primary rounded-md p-1 border border-bron-border mr-1">
                    <button
                      type="button"
                      onClick={() => handleModeChange('domain-only')}
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all duration-200
                        ${
                          keywordMode === 'domain-only'
                            ? 'bg-bron-bg-secondary text-bron-text-primary shadow-sm border border-bron-border/50'
                            : 'text-bron-text-muted hover:text-bron-text-secondary hover:bg-bron-bg-secondary/50'
                        }
                      `}
                    >
                      <Globe2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Domain</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleModeChange('full-url')}
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all duration-200
                        ${
                          keywordMode === 'full-url'
                            ? 'bg-bron-accent-red text-white shadow-sm'
                            : 'text-bron-text-muted hover:text-bron-text-secondary hover:bg-bron-bg-secondary/50'
                        }
                      `}
                    >
                      <Link className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Full URL</span>
                    </button>
                  </div>
                )}

                {/* Domain Mode Badge (only when domain mode) */}
                {searchType === 'domain' && (
                  <span className="mr-3 text-xs font-medium text-bron-accent-blue bg-bron-accent-blue/10 px-3 py-1.5 rounded-md border border-bron-accent-blue/20">
                    Domain Mode
                  </span>
                )}

                {/* Search Button */}
                <Button
                  onClick={handleSearch}
                  disabled={isLoading || !query.trim()}
                  className="h-11 px-6 bg-bron-accent-red hover:bg-red-700 text-white rounded-md font-medium transition-colors text-sm shadow-md mr-1.5"
                >
                  {isLoading ? "Searching..." : "Search"}
                </Button>
              </div>
            </div>

            {/* Helper Text - Dynamic based on mode (only show when there's input) */}
            {query.trim().length > 0 && (
              <div className="text-center w-full">
                <p className="text-xs text-bron-text-muted transition-all duration-300">
                  {searchType === 'domain' ? (
                    <span>
                      Searching for subdomains related to{' '}
                      <span className="text-bron-accent-blue font-medium">this domain</span>.
                    </span>
                  ) : keywordMode === 'domain-only' ? (
                    <span>
                      Searching keyword inside{' '}
                      <span className="text-bron-text-primary font-medium">domain & subdomains</span> only.
                    </span>
                  ) : (
                    <span>
                      Searching keyword inside{' '}
                      <span className="text-bron-accent-red font-medium">full URL paths</span> & parameters.
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

