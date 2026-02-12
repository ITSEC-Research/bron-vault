"use client"

import React, { useState } from "react"
import { Search, Mail, Globe, HelpCircle, X, Blocks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { QueryBuilder } from "./QueryBuilder"

interface SearchInterfaceProps {
  searchQuery: string
  setSearchQuery: (query: string) => void
  searchType: "email" | "domain"
  setSearchType: (type: "email" | "domain") => void
  isLoading: boolean
  onSearch: () => void
  onDetectSearchType: (query: string) => void
}

export function SearchInterface({
  searchQuery,
  setSearchQuery,
  searchType,
  setSearchType: _setSearchType,
  isLoading,
  onSearch,
  onDetectSearchType,
}: SearchInterfaceProps) {
  const [showOperatorGuide, setShowOperatorGuide] = useState(false)
  const [showBuilder, setShowBuilder] = useState(false)

  return (
    <div className="flex flex-col items-center space-y-4">
      <Card className="glass-card border-border w-full max-w-3xl mx-auto">
        <CardContent className="p-6">
          {/* Standard search bar – hidden when builder is active */}
          {!showBuilder && (
            <>
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Search by email or domain... (use , for multiple)"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      onDetectSearchType(e.target.value)
                    }}
                    onKeyPress={(e) => e.key === "Enter" && onSearch()}
                    className="pl-10 h-12 text-lg glass border-border/50 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <Button
                  onClick={() => setShowOperatorGuide(!showOperatorGuide)}
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 text-muted-foreground hover:text-foreground shrink-0"
                  title="Search operators"
                >
                  {showOperatorGuide ? <X className="h-4 w-4" /> : <HelpCircle className="h-4 w-4" />}
                </Button>
                <Button
                  onClick={onSearch}
                  disabled={isLoading || !searchQuery.trim()}
                  className="h-12 px-6 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {isLoading ? "Searching..." : "Search"}
                </Button>
              </div>
              <div className="flex items-center mt-2">
                <Badge
                  variant={searchType === "email" ? "default" : "secondary"}
                  className={
                    (searchType === "email"
                      ? "bg-primary text-primary-foreground"
                      : "glass border-white/5") +
                    " rounded-none px-3 py-1 border-r-0"
                  }
                  style={{ borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }}
                >
                  <Mail className="h-3 w-3 mr-1" />
                  Email
                </Badge>
                <Badge
                  variant={searchType === "domain" ? "default" : "secondary"}
                  className={
                    (searchType === "domain"
                      ? "bg-primary text-primary-foreground"
                      : "glass border-white/5") +
                    " rounded-none px-3 py-1 border-l-0"
                  }
                  style={{ borderTopRightRadius: 4, borderBottomRightRadius: 4 }}
                >
                  <Globe className="h-3 w-3 mr-1" />
                  Domain
                </Badge>
                <span className="ml-3 text-xs text-muted-foreground">
                  Tip: <code className="text-foreground/70 bg-secondary/50 px-1 rounded">,</code> = OR &nbsp; <code className="text-foreground/70 bg-secondary/50 px-1 rounded">+</code> = AND
                </span>
              </div>

              {/* Operator Guide */}
              {showOperatorGuide && (
                <div className="mt-3 p-3 rounded-lg border border-border/50 bg-secondary/30 text-sm">
                  <p className="font-medium text-foreground mb-2">Search Operators</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
                    <div>
                      <code className="text-foreground/80 bg-secondary/50 px-1 rounded">a.com, b.com</code>
                      <span className="ml-1.5">OR &mdash; either domain</span>
                    </div>
                    <div>
                      <code className="text-foreground/80 bg-secondary/50 px-1 rounded">a.com + b.com</code>
                      <span className="ml-1.5">AND &mdash; device has both</span>
                    </div>
                    <div>
                      <code className="text-foreground/80 bg-secondary/50 px-1 rounded">-staging.a.com</code>
                      <span className="ml-1.5">NOT &mdash; exclude</span>
                    </div>
                    <div>
                      <code className="text-foreground/80 bg-secondary/50 px-1 rounded">*.a.com</code>
                      <span className="ml-1.5">Wildcard pattern</span>
                    </div>
                    <div>
                      <code className="text-foreground/80 bg-secondary/50 px-1 rounded">&quot;exact@mail&quot;</code>
                      <span className="ml-1.5">Exact match</span>
                    </div>
                    <div>
                      <code className="text-foreground/80 bg-secondary/50 px-1 rounded">user:admin</code>
                      <span className="ml-1.5">Fields: domain, user, url, browser, pass</span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground/70">
                    Examples: <code className="text-foreground/60">a.com + b.com</code> (devices with both) &bull; <code className="text-foreground/60">a.com, b.com, -staging.a.com</code> (either, excluding staging)
                  </p>
                </div>
              )}
            </>
          )}

          {/* Visual Query Builder */}
          {showBuilder && (
            <QueryBuilder
              initialQuery={searchQuery}
              isLoading={isLoading}
              onQueryChange={(q) => {
                setSearchQuery(q)
                onDetectSearchType(q)
              }}
              onSearch={onSearch}
            />
          )}

          {/* Toggle between text and builder mode */}
          <div className="flex items-center justify-center mt-3 pt-3 border-t border-border/30">
            <button
              type="button"
              onClick={() => setShowBuilder(!showBuilder)}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm text-foreground/75 bg-muted/40 border border-primary/20 hover:border-primary/35 hover:bg-primary/5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-background [&>svg]:text-primary/70"
            >
              <Blocks className="h-4 w-4 shrink-0" />
              {showBuilder ? "Switch to text mode" : "Switch to visual query builder"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
