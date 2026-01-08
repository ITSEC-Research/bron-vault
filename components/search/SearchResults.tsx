"use client"

import React, { useEffect, useRef } from "react"
import { Copy, CloudUpload, CalendarClock, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading"

interface SearchResult {
  deviceId: string
  deviceName: string
  uploadBatch: string
  matchingFiles: string[]
  matchedContent: string[]
  files: any[]
  totalFiles: number
  upload_date?: string
  uploadDate?: string
  logDate?: string
}

interface SearchResultsProps {
  searchResults: SearchResult[]
  searchQuery: string
  onDeviceSelect: (device: SearchResult) => void
  isLoading?: boolean
  hasMore?: boolean
  totalDevices?: number
  onLoadMore?: () => void
}

export function SearchResults({ 
  searchResults, 
  searchQuery, 
  onDeviceSelect,
  isLoading = false,
  hasMore = false,
  totalDevices = 0,
  onLoadMore,
}: SearchResultsProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    try {
      // Handle MySQL datetime format 'YYYY-MM-DD HH:mm:ss'
      let isoString = dateString
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)) {
        isoString = dateString.replace(' ', 'T') + 'Z' // treat as UTC
      }
      const date = new Date(isoString)
      if (isNaN(date.getTime())) {
        // fallback: parse manually
        const parts = dateString.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
        if (parts) {
          return `${parts[3]}/${parts[2]}/${parts[1]} ${parts[4]}:${parts[5]}:${parts[6]}`
        }
        return dateString
      }
      // Format as MM/DD/YYYY HH:MM:SS (24-hour format)
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const year = date.getFullYear()
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`
    } catch (_e) {
      return dateString
    }
  }

  const normalizeLogDate = (logDate: string | null | undefined): string => {
    if (!logDate) return "N/A"
    
    try {
      let date: Date | null = null
      const trimmedDate = logDate.trim()
      
      // Extract date part and time part separately
      const parts = trimmedDate.split(' ')
      const datePart = parts[0]
      const timePart = parts.slice(1).join(' ') // Keep all remaining parts as time (could be "HH:MM:SS" or "HH:MM:SS CEST")
      
      // Try DD/MM/YYYY format (with or without time) - European format
      const ddmmyyyySlash = datePart.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      if (ddmmyyyySlash) {
        const [, day, month, year] = ddmmyyyySlash
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      }
      
      // Try DD.MM.YYYY format (with or without time) - European format
      if (!date || isNaN(date.getTime())) {
        const ddmmyyyyDot = datePart.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
        if (ddmmyyyyDot) {
          const [, day, month, year] = ddmmyyyyDot
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        }
      }
      
      // Try YYYY-MM-DD format (with or without time) - ISO format
      if (!date || isNaN(date.getTime())) {
        const yyyymmdd = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        if (yyyymmdd) {
          const [, year, month, day] = yyyymmdd
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        }
      }
      
      // Try YYYY/MM/DD format (with or without time)
      if (!date || isNaN(date.getTime())) {
        const yyyymmddSlash = datePart.match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
        if (yyyymmddSlash) {
          const [, year, month, day] = yyyymmddSlash
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        }
      }
      
      // Try MM/DD/YYYY format (US format) - check this after DD/MM/YYYY to avoid ambiguity
      if (!date || isNaN(date.getTime())) {
        // Only try if we haven't matched DD/MM/YYYY pattern
        const mmddyyyy = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
        if (mmddyyyy && !ddmmyyyySlash) {
          const [, month, day, year] = mmddyyyy
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        }
      }
      
      // Try text formats with month names
      if (!date || isNaN(date.getTime())) {
        // Try "June 28, 2025" or "Jun 28, 2025"
        const monthFirst = trimmedDate.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})/)
        if (monthFirst) {
          date = new Date(monthFirst[0])
        }
      }
      
      if (!date || isNaN(date.getTime())) {
        // Try "28 Jun 2025" or "28 June 2025"
        const dayFirst = trimmedDate.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})/)
        if (dayFirst) {
          date = new Date(dayFirst[0])
        }
      }
      
      // Fallback: try native Date parsing
      if (!date || isNaN(date.getTime())) {
        date = new Date(trimmedDate)
      }
      
      // If we successfully parsed the date, format it as MM/DD/YYYY
      if (date && !isNaN(date.getTime())) {
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const year = date.getFullYear()
        const normalizedDate = `${month}/${day}/${year}`
        
        // If there's a time part, append it
        if (timePart && timePart.trim()) {
          // Clean up time part - remove timezone abbreviations if present, keep just time
          const timeOnly = timePart.replace(/\s+[A-Z]{2,}$/i, '').trim() // Remove timezone like "CEST"
          return `${normalizedDate} ${timeOnly}`
        }
        
        return normalizedDate
      }
      
      // Fallback: return original if we can't parse it
      return logDate
    } catch (_e) {
      return logDate
    }
  }

  const getMatchingFileNames = (matchingFiles: string[]) => {
    return matchingFiles.map((filePath) => {
      const fileName = filePath.split("/").pop() || filePath
      return fileName
    })
  }

  const groupResultsByName = (results: SearchResult[]) => {
    const grouped = new Map<string, SearchResult[]>()
    results.forEach((result) => {
      if (!grouped.has(result.deviceName)) {
        grouped.set(result.deviceName, [])
      }
      grouped.get(result.deviceName)!.push(result)
    })
    return grouped
  }

  // Infinite scroll: Setup Intersection Observer
  useEffect(() => {
    if (!onLoadMore || !hasMore) return

    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    // Create new observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && onLoadMore) {
          onLoadMore()
        }
      },
      { threshold: 0.1 }
    )

    // Observe the load more trigger element
    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [hasMore, isLoading, onLoadMore])

  // Don't render anything if no results and not loading and no search query
  if (searchResults.length === 0 && !isLoading && !searchQuery) {
    return null
  }

  const groupedResults = groupResultsByName(searchResults)
  const displayCount = totalDevices > 0 ? totalDevices : searchResults.length

  return (
    <div className="space-y-4">
      {/* Header - only show count if we have results or finished loading */}
      {(!isLoading && (searchResults.length > 0 || totalDevices > 0)) && (
        <h2 className="text-lg font-semibold text-foreground">
          Found {displayCount.toLocaleString()} device instance(s) containing &quot;{searchQuery}&quot;
          {searchResults.length < displayCount && (
            <span className="text-sm text-muted-foreground font-normal ml-2">
              (showing {searchResults.length.toLocaleString()})
            </span>
          )}
        </h2>
      )}
      
      {/* Loading indicator */}
      {isLoading && searchResults.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <LoadingState type="search" message={`Searching for devices containing "${searchQuery}"...`} size="md" />
        </div>
      )}
      
      {/* Show existing results while loading more */}
      {isLoading && searchResults.length > 0 && (
        <h2 className="text-lg font-semibold text-foreground">
          Found {displayCount.toLocaleString()} device instance(s) containing &quot;{searchQuery}&quot;
          {searchResults.length < displayCount && (
            <span className="text-sm text-muted-foreground font-normal ml-2">
              (showing {searchResults.length.toLocaleString()})
            </span>
          )}
          <span className="text-sm text-muted-foreground font-normal ml-2">
            <span className="inline-flex items-center justify-center h-4 w-4 mr-1 relative align-middle">
              <span className="absolute inset-0 border-2 border-primary/20 border-t-primary/60 rounded-full animate-spin" />
              <Loader2 className="h-2.5 w-2.5 text-primary" />
            </span>
            Loading more...
          </span>
        </h2>
      )}

      <div className="grid gap-3">
        {Array.from(groupedResults.entries()).map(([deviceName, devices]) => (
          <div key={deviceName} className="space-y-2">
            {devices.length > 1 && (
              <div className="flex items-center space-x-2 mb-2">
                <Badge
                  variant="outline"
                  className="glass border-primary/30 text-primary"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {devices.length} instances of &quot;{deviceName}&quot;
                </Badge>
              </div>
            )}

            {devices.map((result, index) => {
              const matchingFileNames = getMatchingFileNames(result.matchingFiles)
              return (
                <Card
                  key={result.deviceId}
                  className="w-full cursor-pointer glass-card border-border hover:border-primary/70 transition-all duration-300"
                  onClick={() => onDeviceSelect(result)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-base text-foreground truncate">
                            {result.deviceName}
                          </h3>
                          {devices.length > 1 && (
                            <Badge
                              variant="secondary"
                              className="text-xs glass border-white/5 shrink-0"
                            >
                              #{index + 1}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-muted-foreground font-mono opacity-70 truncate">
                            ID: {result.deviceId}
                          </p>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <div className="inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px] glass border-white/5">
                              {result.matchingFiles.length.toLocaleString()} matches
                            </div>
                            <div className="inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px] glass border-white/5">
                              {result.totalFiles.toLocaleString()} files
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground -mt-1">
                        <div className="flex items-center gap-1.5">
                          <CloudUpload className="w-3.5 h-3.5" />
                          <span>{formatDate(result.uploadDate || result.upload_date || "")}</span>
                        </div>
                        {result.logDate && (
                          <>
                            <span className="hidden sm:inline text-muted-foreground/20">|</span>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium glass border-blue-500/30 text-blue-500">
                              <CalendarClock className="w-3 h-3" />
                              <span className="text-xs">Log: {normalizeLogDate(result.logDate)}</span>
                            </div>
                          </>
                        )}
                      </div>

                      {matchingFileNames.length > 0 && (
                        <div className="flex items-center gap-2 pt-3 border-t border-border/40 mt-1">
                          <span className="text-xs text-muted-foreground">Files:</span>
                          <div className="flex flex-wrap gap-1">
                            {matchingFileNames.slice(0, 2).map((fileName, idx) => (
                              <div
                                key={idx}
                                className="inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px] glass border-orange-500/30 text-orange-500"
                              >
                                {fileName}
                              </div>
                            ))}
                            {matchingFileNames.length > 2 && (
                              <div className="inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-[10px] glass border-orange-500/30 text-orange-500">
                                +{matchingFileNames.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ))}
      </div>

      {/* Infinite scroll trigger and loading indicator */}
      {hasMore && (
        <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="relative flex items-center justify-center h-5 w-5">
                <span className="absolute inset-0 border-2 border-primary/20 border-t-primary/60 rounded-full animate-spin" />
                <Loader2 className="h-3 w-3 text-primary" />
              </span>
              <span className="text-sm">Loading more devices...</span>
            </div>
          )}
        </div>
      )}

      {/* All devices loaded message */}
      {!hasMore && searchResults.length > 0 && (
        <div className="text-center text-muted-foreground py-4 text-sm">
          All {displayCount.toLocaleString()} device(s) loaded
        </div>
      )}
    </div>
  )
}
