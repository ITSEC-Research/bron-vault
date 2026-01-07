"use client"

import React, { useState, useEffect, useMemo } from "react"
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

interface DeviceSoftwareTableProps {
  deviceId: string
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
          <div className="cursor-default hover:bg-white/5 rounded px-1 py-0.5 transition-colors">
            {children || <span className="text-foreground">{displayContent}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs break-all glass-card shadow-lg p-3"
        >
          <div className="font-mono text-xs select-text text-foreground">{content}</div>
          <div className="text-xs text-muted-foreground mt-1">Highlight text to copy manually</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function DeviceSoftwareTable({ deviceId }: DeviceSoftwareTableProps) {
  const [deviceSoftware, setDeviceSoftware] = useState<Software[]>([])
  const [isLoadingSoftware, setIsLoadingSoftware] = useState(true)
  const [softwareError, setSoftwareError] = useState<string>("")
  const [softwareSearchQuery, setSoftwareSearchQuery] = useState("")
  const [deduplicate, setDeduplicate] = useState(false)

  // Load software
  useEffect(() => {
    const loadSoftware = async () => {
      setIsLoadingSoftware(true)
      setSoftwareError("")

      try {
        const response = await fetch("/api/device-software", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ deviceId }),
        })

        if (response.ok) {
          const software = await response.json()
          setDeviceSoftware(software)
        } else {
          const errorData = await response.json()
          setSoftwareError(errorData.error || "Failed to load software")
        }
      } catch (error) {
        console.error("Failed to load software:", error)
        setSoftwareError(`Network Error: ${error instanceof Error ? error.message : "Unknown error"}`)
      } finally {
        setIsLoadingSoftware(false)
      }
    }

    loadSoftware()
  }, [deviceId])

  const filteredSoftware = useMemo(() => {
    let filtered = deviceSoftware

    // Apply search filter
    if (softwareSearchQuery.trim()) {
      const searchLower = softwareSearchQuery.toLowerCase()
      filtered = filtered.filter(
        (sw) =>
          sw.software_name.toLowerCase().includes(searchLower) ||
          sw.version.toLowerCase().includes(searchLower),
      )
    }

    // Apply deduplication if enabled
    if (deduplicate) {
      const seen = new Set<string>()
      filtered = filtered.filter((sw) => {
        const key = `${sw.software_name}|${sw.version || "N/A"}`
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
        <p className="text-xs text-foreground">Loading software...</p>
      </div>
    )
  }

  if (softwareError) {
    return (
      <div className="text-center py-8">
        <Alert variant="destructive" className="glass-card border-l-4 border-l-destructive">
          <AlertDescription className="text-xs text-foreground">{softwareError}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (deviceSoftware.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <div className="space-y-2">
          <p className="text-xs">No software found for this device</p>
          <p className="text-xs">Device ID: {deviceId}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search Bar Section */}
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">
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
              className="w-full h-9 text-sm glass-card border-border/50 text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeduplicate(!deduplicate)}
            className={`h-9 px-3 flex items-center space-x-2 shrink-0 border-border/50 text-foreground hover:bg-white/5 transition-colors ${
              deduplicate
                ? "bg-primary/20 border-primary text-primary"
                : "glass-card"
            }`}
            title={deduplicate ? "Show duplicates" : "Hide duplicates"}
          >
            <Filter className="h-4 w-4" />
            <span className="text-xs">{deduplicate ? "Show All" : "Deduplicate"}</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-white/5">
              <TableHead className="sticky top-0 z-20 glass-card text-muted-foreground border-b border-white/5 text-xs h-9 py-2 px-3">
                <div className="flex items-center space-x-1">
                  <Package className="h-4 w-4" />
                  <span>Software Name</span>
                </div>
              </TableHead>
              <TableHead className="sticky top-0 z-20 glass-card text-muted-foreground border-b border-white/5 text-xs h-9 py-2 px-3">
                <span>Version</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSoftware.map((sw, index) => (
              <TableRow key={index} className="border-b border-border/50 hover:bg-white/5 transition-colors">
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
        <div className="text-center py-8 text-muted-foreground">
          <p>No software found matching &quot;{softwareSearchQuery}&quot;</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSoftwareSearchQuery("")}
            className="mt-2 text-foreground hover:bg-white/5"
          >
            Clear search
          </Button>
        </div>
      )}
    </div>
  )
}

