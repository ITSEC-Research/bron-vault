"use client"

import React from "react"
import { Copy } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState, LoadingTable } from "@/components/ui/loading"

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
}

interface SearchResultsProps {
  searchResults: SearchResult[]
  searchQuery: string
  onDeviceSelect: (device: SearchResult) => void
}

export function SearchResults({ searchResults, searchQuery, onDeviceSelect }: SearchResultsProps) {
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    try {
      // Handle MySQL datetime format 'YYYY-MM-DD HH:mm:ss'
      let isoString = dateString
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)) {
        isoString = dateString.replace(' ', 'T') + 'Z' // treat as UTC
      }
      let date = new Date(isoString)
      if (isNaN(date.getTime())) {
        // fallback: parse manually
        const parts = dateString.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
        if (parts) {
          return `${parts[3]}/${parts[2]}/${parts[1]} ${parts[4]}:${parts[5]}:${parts[6]}`
        }
        return dateString
      }
      return date.toLocaleString()
    } catch (e) {
      return dateString
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

  if (searchResults.length === 0) {
    return null
  }

  const groupedResults = groupResultsByName(searchResults)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-bron-text-primary">
        Found {searchResults.length} device instance(s) containing "{searchQuery}"
      </h2>

      <div className="grid gap-3">
        {Array.from(groupedResults.entries()).map(([deviceName, devices]) => (
          <div key={deviceName} className="space-y-2">
            {devices.length > 1 && (
              <div className="flex items-center space-x-2 mb-2">
                <Badge
                  variant="outline"
                  className="bg-bron-accent-yellow/20 text-bron-accent-yellow border-bron-accent-yellow"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {devices.length} instances of "{deviceName}"
                </Badge>
              </div>
            )}

            {devices.map((result, index) => {
              const matchingFileNames = getMatchingFileNames(result.matchingFiles)
              return (
                <Card
                  key={result.deviceId}
                  className="w-full cursor-pointer hover:shadow-md transition-shadow bg-bron-bg-tertiary border-bron-border hover:border-bron-accent-red"
                  onClick={() => onDeviceSelect(result)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold text-lg text-bron-text-primary">
                            {result.deviceName}
                          </h3>
                          {devices.length > 1 && (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-bron-bg-secondary text-bron-text-secondary border-bron-border"
                            >
                              #{index + 1}
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-1 text-sm text-bron-text-muted">
                          <p>Device ID: {result.deviceId}</p>
                          <p>Upload Date: {formatDate(result.uploadDate || result.upload_date || "")}</p>
                          <div className="flex items-center space-x-2">
                            <span>Matching files:</span>
                            <div className="flex flex-wrap gap-1">
                              {matchingFileNames.slice(0, 3).map((fileName, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-xs bg-bron-accent-yellow/20 text-bron-accent-yellow border-bron-accent-yellow"
                                >
                                  {fileName}
                                </Badge>
                              ))}
                              {matchingFileNames.length > 3 && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-bron-bg-secondary text-bron-text-secondary border-bron-border"
                                >
                                  +{matchingFileNames.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Badge
                          variant="outline"
                          className="bg-bron-bg-secondary text-bron-text-secondary border-bron-border"
                        >
                          {result.matchingFiles.length.toLocaleString()} matches
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="bg-bron-bg-secondary text-bron-text-secondary border-bron-border"
                        >
                          {result.totalFiles.toLocaleString()} files
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
