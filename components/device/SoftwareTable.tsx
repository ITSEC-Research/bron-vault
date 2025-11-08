"use client"

import React, { useMemo, useState } from "react"
import { Package, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface Software {
  software_name: string
  version: string
  source_file: string
}

interface SoftwareTableProps {
  deviceSoftware: Software[]
  isLoadingSoftware: boolean
  softwareError: string
  softwareSearchQuery: string
  setSoftwareSearchQuery: (query: string) => void
  onRetrySoftware: () => void
  deviceId: string
  hideSearchBar?: boolean
  deduplicate?: boolean
}

// Simple hover tooltip for manual copy
const HoverableCell = ({
  content,
  maxLength,
  children,
}: {
  content: string
  maxLength?: number
  children?: React.ReactNode
}) => {
  const displayContent = maxLength && content.length > maxLength ? `${content.substring(0, maxLength)}...` : content

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default hover:bg-bron-bg-tertiary rounded px-1 py-0.5 transition-colors">
            {children || <span className="text-bron-text-primary">{displayContent}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs break-all bg-bron-bg-tertiary border border-bron-border shadow-lg p-3"
        >
          <div className="font-mono text-xs select-text text-bron-text-primary">{content}</div>
          <div className="text-xs text-bron-text-muted mt-1">Highlight text to copy manually</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function SoftwareTable({
  deviceSoftware,
  isLoadingSoftware,
  softwareError,
  softwareSearchQuery,
  setSoftwareSearchQuery,
  onRetrySoftware,
  deviceId,
  hideSearchBar = false,
  deduplicate: externalDeduplicate,
}: SoftwareTableProps) {
  const [internalDeduplicate, setInternalDeduplicate] = useState(false)
  const deduplicate = externalDeduplicate !== undefined ? externalDeduplicate : internalDeduplicate

  const filteredSoftware = useMemo(() => {
    let filtered = deviceSoftware

    // Apply search filter
    if (softwareSearchQuery.trim()) {
      const searchLower = softwareSearchQuery.toLowerCase()
      filtered = filtered.filter((sw) => 
        sw.software_name.toLowerCase().includes(searchLower) ||
        sw.version.toLowerCase().includes(searchLower)
      )
    }

    // Apply deduplication if enabled
    if (deduplicate) {
      const seen = new Set<string>()
      filtered = filtered.filter((sw) => {
        const key = `${sw.software_name}|${sw.version || 'N/A'}`
        if (seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      })
    }

    return filtered
  }, [deviceSoftware, softwareSearchQuery, deduplicate])

  if (isLoadingSoftware) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-bron-text-primary">Loading software...</p>
      </div>
    )
  }

  if (softwareError) {
    return (
      <div className="text-center py-8">
        <Alert variant="destructive" className="bg-bron-accent-red/20 border-bron-accent-red">
          <AlertDescription className="text-bron-text-primary">{softwareError}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (deviceSoftware.length === 0) {
    return (
      <div className="text-center py-8 text-bron-text-muted">
        <div className="space-y-2">
          <p>No software found for this device</p>
          <p className="text-xs">Device ID: {deviceId}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetrySoftware}
            className="bg-bron-bg-tertiary border-bron-border text-bron-text-primary hover:bg-bron-bg-primary"
          >
            Retry Loading
          </Button>
        </div>
      </div>
    )
  }

  const searchBarSection = (
    <div className="space-y-3">
      <div className="text-sm text-bron-text-muted">
        Found {deviceSoftware.length} software installed on this device
        {deduplicate && ` (${filteredSoftware.length} unique)`}
        {softwareSearchQuery && !deduplicate && ` (${filteredSoftware.length} filtered)`}
        {softwareSearchQuery && deduplicate && ` (${filteredSoftware.length} unique filtered)`}
      </div>
      <div className="flex items-center space-x-3">
        <div className="w-80">
          <Input
            type="text"
            placeholder="Search software name or version..."
            value={softwareSearchQuery}
            onChange={(e) => setSoftwareSearchQuery(e.target.value)}
            className="w-full h-9 text-sm bg-bron-bg-tertiary border-bron-border text-bron-text-primary placeholder:text-bron-text-muted"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (externalDeduplicate === undefined) {
              setInternalDeduplicate(!deduplicate)
            }
          }}
          className={`h-9 px-3 flex items-center space-x-2 shrink-0 border-bron-border text-bron-text-primary hover:bg-bron-bg-primary ${
            deduplicate 
              ? "bg-bron-accent-red/20 border-bron-accent-red text-bron-accent-red" 
              : "bg-bron-bg-tertiary"
          }`}
          title={deduplicate ? "Show duplicates" : "Hide duplicates"}
        >
          <Filter className="h-4 w-4" />
          <span className="text-xs">{deduplicate ? "Show All" : "Deduplicate"}</span>
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {!hideSearchBar && searchBarSection}
      <div className="bg-bron-bg-tertiary border border-bron-border rounded-lg overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] sm:max-h-[calc(100vh-350px)] pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-bron-bg-primary">
              <TableHead className="sticky top-0 z-20 bg-bron-bg-tertiary text-bron-text-secondary border-b border-bron-border text-xs h-9 py-2 px-3">
                <div className="flex items-center space-x-1">
                  <Package className="h-4 w-4" />
                  <span>Software Name</span>
                </div>
              </TableHead>
              <TableHead className="sticky top-0 z-20 bg-bron-bg-tertiary text-bron-text-secondary border-b border-bron-border text-xs h-9 py-2 px-3">
                <span>Version</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSoftware.map((sw, index) => (
              <TableRow
                key={index}
                className="border-b border-bron-border hover:bg-bron-bg-primary"
              >
                <TableCell className="font-medium text-xs py-2 px-3">
                  <HoverableCell content={sw.software_name} maxLength={70} />
                </TableCell>
                <TableCell className="text-xs py-2 px-3">
                  <HoverableCell content={sw.version || "N/A"} maxLength={30} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {filteredSoftware.length === 0 && softwareSearchQuery && (
        <div className="text-center py-8 text-bron-text-muted">
          <p>No software found matching "{softwareSearchQuery}"</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSoftwareSearchQuery("")}
            className="mt-2 text-bron-text-primary hover:bg-bron-bg-tertiary"
          >
            Clear search
          </Button>
        </div>
      )}
    </div>
  )
}

// Export search bar section for use outside ScrollArea
export function SoftwareSearchBar({
  deviceSoftware,
  softwareSearchQuery,
  setSoftwareSearchQuery,
  deduplicate,
  setDeduplicate,
  filteredCount,
}: {
  deviceSoftware: Software[]
  softwareSearchQuery: string
  setSoftwareSearchQuery: (query: string) => void
  deduplicate: boolean
  setDeduplicate: (value: boolean) => void
  filteredCount: number
}) {
  return (
    <div className="space-y-3 mb-4">
      <div className="text-sm text-bron-text-muted">
        Found {deviceSoftware.length} software installed on this device
        {deduplicate && ` (${filteredCount} unique)`}
        {softwareSearchQuery && !deduplicate && ` (${filteredCount} filtered)`}
        {softwareSearchQuery && deduplicate && ` (${filteredCount} unique filtered)`}
      </div>
      <div className="flex items-center space-x-3">
        <div className="w-80">
          <Input
            type="text"
            placeholder="Search software name or version..."
            value={softwareSearchQuery}
            onChange={(e) => setSoftwareSearchQuery(e.target.value)}
            className="w-full h-9 text-sm bg-bron-bg-tertiary border-bron-border text-bron-text-primary placeholder:text-bron-text-muted"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDeduplicate(!deduplicate)}
          className={`h-9 px-3 flex items-center space-x-2 shrink-0 border-bron-border text-bron-text-primary hover:bg-bron-bg-primary ${
            deduplicate 
              ? "bg-bron-accent-red/20 border-bron-accent-red text-bron-accent-red" 
              : "bg-bron-bg-tertiary"
          }`}
          title={deduplicate ? "Show duplicates" : "Hide duplicates"}
        >
          <Filter className="h-4 w-4" />
          <span className="text-xs">{deduplicate ? "Show All" : "Deduplicate"}</span>
        </Button>
      </div>
    </div>
  )
}

