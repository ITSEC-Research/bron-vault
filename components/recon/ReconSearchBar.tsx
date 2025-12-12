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
          <span className="text-sm text-muted-foreground">Target:</span>
          <span className="text-sm font-medium text-foreground">{targetDomain}</span>
        </div>
        {onClear && (
          <Button
            onClick={onClear}
            variant="outline"
            size="sm"
            className="glass-card border-border/50 text-foreground hover:bg-white/5"
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
      <Card className="glass-card border-border/50 w-full max-w-3xl mx-auto">
        <CardContent className="p-6">
          <div className="flex flex-col items-center space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-foreground mb-2">
                Discover Subdomains and Paths Across Logs
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter a <span className="text-blue-500 font-medium">domain</span> or <span className="text-primary font-medium">keyword</span> to explore its footprint
              </p>
            </div>
            {/* Main Search Component with Enhanced UI */}
            <div className="relative group w-full">
              <div
                className="flex items-center w-full rounded-lg border border-border/50 glass-card transition-all duration-200 shadow-sm"
              >
                {/* Left Icon - Auto-detect Indicator */}
                <div className="pl-4 pr-3 flex items-center justify-center pointer-events-none">
                  {searchType === 'domain' ? (
                    <Globe className="w-5 h-5 text-blue-500 transition-all duration-300" />
                  ) : (
                    <Key className="w-5 h-5 text-primary transition-all duration-300" />
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
                  className="flex-1 bg-transparent border-none outline-none h-14 text-lg text-foreground placeholder:text-muted-foreground min-w-0"
                />

                {/* Scope Selector - Segmented Control (only when keyword mode) */}
                {searchType === 'keyword' && (
                  <div className="flex items-center bg-white/5 rounded-md p-1 border border-border/50 mr-1">
                    <button
                      type="button"
                      onClick={() => handleModeChange('domain-only')}
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-all duration-200
                        ${
                          keywordMode === 'domain-only'
                            ? 'glass-card text-foreground shadow-sm border border-border/50'
                            : 'text-muted-foreground hover:text-muted-foreground hover:glass-card/50'
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
                            ? 'bg-primary text-white shadow-sm'
                            : 'text-muted-foreground hover:text-muted-foreground hover:glass-card/50'
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
                  <span className="mr-3 text-xs font-medium text-blue-500 bg-blue-500/10 px-3 py-1.5 rounded-md border border-blue-500/20">
                    Domain Mode
                  </span>
                )}

                {/* Search Button */}
                <Button
                  onClick={handleSearch}
                  disabled={isLoading || !query.trim()}
                  className="h-11 px-6 bg-primary hover:bg-primary/90 text-white rounded-md font-medium transition-colors text-sm shadow-md mr-1.5"
                >
                  {isLoading ? "Searching..." : "Search"}
                </Button>
              </div>
            </div>

            {/* Helper Text - Dynamic based on mode (only show when there's input) */}
            {query.trim().length > 0 && (
              <div className="text-center w-full">
                <p className="text-xs text-muted-foreground transition-all duration-300">
                  {searchType === 'domain' ? (
                    <span>
                      Searching for subdomains related to{' '}
                      <span className="text-blue-500 font-medium">this domain</span>.
                    </span>
                  ) : keywordMode === 'domain-only' ? (
                    <span>
                      Searching keyword inside{' '}
                      <span className="text-foreground font-medium">domain & subdomains</span> only.
                    </span>
                  ) : (
                    <span>
                      Searching keyword inside{' '}
                      <span className="text-primary font-medium">full URL paths</span> & parameters.
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

