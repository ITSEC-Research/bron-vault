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
            ? "bg-gradient-to-r from-bron-accent-red/10 via-bron-accent-red/5 to-bron-bg-tertiary border border-bron-accent-red/30"
            : "bg-bron-bg-tertiary border border-bron-border hover:bg-bron-bg-primary"
        }`}
      >
        <Icon
          className={`h-3.5 w-3.5 shrink-0 ${
            isPrimary ? "text-bron-accent-red" : "text-bron-text-secondary"
          }`}
        />
        <div className="flex items-center space-x-1.5 flex-1 min-w-0">
          <span
            className={`text-xs font-medium shrink-0 ${
              isPrimary ? "text-bron-accent-red" : "text-bron-text-secondary"
            }`}
          >
            {label}:
          </span>
          <span
            className={`text-xs truncate ${
              isPrimary ? "text-bron-text-primary font-semibold" : "text-bron-text-primary"
            } ${isEmpty ? "text-bron-text-muted italic" : ""}`}
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
            ? "bg-gradient-to-r from-bron-accent-red/10 via-bron-accent-red/5 to-bron-bg-tertiary border border-bron-accent-red/30"
            : "bg-bron-bg-tertiary border border-bron-border hover:bg-bron-bg-primary"
        }`}
      >
        <Icon
          className={`h-4 w-4 mt-0.5 shrink-0 ${
            isPrimary ? "text-bron-accent-red" : "text-bron-text-secondary"
          }`}
        />
        <div className="flex-1 min-w-0">
          <div
            className={`text-xs font-medium mb-0.5 ${
              isPrimary ? "text-bron-accent-red" : "text-bron-text-secondary"
            }`}
          >
            {label}
          </div>
          <div
            className={`text-sm truncate ${
              isPrimary ? "text-bron-text-primary font-semibold" : "text-bron-text-primary"
            } ${isEmpty ? "text-bron-text-muted italic" : ""}`}
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
              className="max-w-xs break-all bg-bron-bg-tertiary border border-bron-border shadow-lg p-3"
            >
              <div className="font-mono text-xs select-text text-bron-text-primary">{value}</div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return content
  }

  return (
    <Card className="bg-bron-bg-tertiary border-bron-border">
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

