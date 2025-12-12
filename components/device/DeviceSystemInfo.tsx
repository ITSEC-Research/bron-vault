"use client"

import React from "react"
import { Monitor, Globe, User, Server, MapPin, FolderOpen } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface DeviceSystemInfoProps {
  operatingSystem?: string
  ipAddress?: string
  username?: string
  hostname?: string
  country?: string
  filePath?: string
}

export function DeviceSystemInfo({
  operatingSystem,
  ipAddress,
  username,
  hostname,
  country,
  filePath,
}: DeviceSystemInfoProps) {
  const InfoItem = ({
    icon: Icon,
    label,
    value,
    isPrimary = false,
    layout = "horizontal", // "horizontal" | "vertical"
  }: {
    icon: React.ElementType
    label: string
    value: string | undefined
    isPrimary?: boolean
    layout?: "horizontal" | "vertical"
  }) => {
    // Always show label, use "N/A" if value is not available
    const displayValue = value || "N/A"
    const isEmpty = !value

    // Horizontal layout: Label di kiri, Value di kanan (dalam satu baris) - Compact version
    const horizontalContent = (
      <div
        className={`flex items-center space-x-1.5 px-2 py-1.5 rounded-md transition-colors ${
          isPrimary
            ? "bg-gradient-to-r from-primary/10 via-primary/5 to-card/60 border border-primary/30"
            : "bg-background/60 border border-border/50 hover:bg-card/80"
        }`}
      >
        <Icon
          className={`h-3.5 w-3.5 shrink-0 ${
            isPrimary ? "text-primary" : "text-muted-foreground"
          }`}
        />
        <div className="flex items-center space-x-1.5 flex-1 min-w-0">
          <span
            className={`text-xs font-medium shrink-0 ${
              isPrimary ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {label}:
          </span>
          <span
            className={`text-xs truncate ${
              isPrimary ? "text-foreground font-semibold" : "text-foreground"
            } ${isEmpty ? "text-muted-foreground italic" : ""}`}
          >
            {displayValue}
          </span>
        </div>
      </div>
    )

    // Vertical layout: Label di atas, Value di bawah
    const verticalContent = (
      <div
        className={`flex items-start space-x-2 p-2 rounded-md transition-colors ${
          isPrimary
            ? "bg-gradient-to-r from-primary/10 via-primary/5 to-card/60 border border-primary/30"
            : "bg-background/60 border border-border/50 hover:bg-card/80"
        }`}
      >
        <Icon
          className={`h-4 w-4 mt-0.5 shrink-0 ${
            isPrimary ? "text-primary" : "text-muted-foreground"
          }`}
        />
        <div className="flex-1 min-w-0">
          <div
            className={`text-xs font-medium mb-0.5 ${
              isPrimary ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {label}
          </div>
          <div
            className={`text-sm truncate ${
              isPrimary ? "text-foreground font-semibold" : "text-foreground"
            } ${isEmpty ? "text-muted-foreground italic" : ""}`}
          >
            {displayValue}
          </div>
        </div>
      </div>
    )

    const content = layout === "horizontal" ? horizontalContent : verticalContent

    // Wrap with tooltip if text is truncated and value exists
    if (value && value.length > 30) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{content}</TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-xs break-all glass-card shadow-lg p-3"
            >
              <div className="font-mono text-xs select-text text-foreground">{value}</div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return content
  }

  return (
    <Card className="glass-card">
      <CardContent className="p-2.5 space-y-2">
        {/* System Information - Grid 3 Columns (Compact for 13" screens) */}
        <div className="grid grid-cols-3 gap-1.5">
          <InfoItem icon={Monitor} label="OS" value={operatingSystem} />
          <InfoItem icon={Globe} label="IP Address" value={ipAddress} />
          <InfoItem icon={User} label="Username" value={username} />
          <InfoItem icon={Server} label="Hostname" value={hostname} />
          <InfoItem icon={MapPin} label="Country" value={country} />
          <InfoItem icon={FolderOpen} label="Path" value={filePath} />
        </div>
      </CardContent>
    </Card>
  )
}

