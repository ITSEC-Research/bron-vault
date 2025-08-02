"use client"

import React from "react"
import { Search, Mail, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { generateId, announceToScreenReader } from "@/lib/accessibility"

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
  setSearchType,
  isLoading,
  onSearch,
  onDetectSearchType,
}: SearchInterfaceProps) {
  return (
    <div className="flex flex-col items-center space-y-4">
      <Card className="bg-bron-bg-tertiary border-bron-border w-full max-w-3xl mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-bron-text-muted h-4 w-4" />
              <Input
                type="text"
                placeholder="Search by email or domain..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  onDetectSearchType(e.target.value)
                }}
                onKeyPress={(e) => e.key === "Enter" && onSearch()}
                className="pl-10 h-12 text-lg bg-bron-bg-tertiary border-bron-border text-bron-text-primary placeholder:text-bron-text-muted"
              />
            </div>
            <Button
              onClick={onSearch}
              disabled={isLoading || !searchQuery.trim()}
              className="h-12 px-6 bg-bron-accent-red hover:bg-bron-accent-red-hover text-white"
            >
              {isLoading ? "Searching..." : "Search"}
            </Button>
          </div>
          <div className="flex items-center mt-2">
            <Badge
              variant={searchType === "email" ? "default" : "secondary"}
              className={
                (searchType === "email"
                  ? "bg-bron-accent-red text-white"
                  : "bg-bron-bg-secondary text-bron-text-secondary border-bron-border") +
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
                  ? "bg-bron-accent-red text-white"
                  : "bg-bron-bg-secondary text-bron-text-secondary border-bron-border") +
                " rounded-none px-3 py-1 border-l-0"
              }
              style={{ borderTopRightRadius: 4, borderBottomRightRadius: 4 }}
            >
              <Globe className="h-3 w-3 mr-1" />
              Domain
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
