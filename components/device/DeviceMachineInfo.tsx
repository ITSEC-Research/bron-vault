"use client"

import React, { useState, useEffect } from "react"
import {
  Monitor,
  Globe,
  User,
  Server,
  MapPin,
  FolderOpen,
  Cpu,
  HardDrive,
  Shield,
  Calendar,
  Fingerprint,
  FileText,
  Clock,
  Tag,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"

interface MachineInfo {
  deviceId: string
  stealerType: string | null
  os: string | null
  ipAddress: string | null
  username: string | null
  cpu: string | null
  ram: string | null
  computerName: string | null
  gpu: string | null
  country: string | null
  logDate: string | null
  hwid: string | null
  filePath: string | null
  antivirus: string | null
  sourceFile: string | null
  createdAt: string | null
}

interface DeviceMachineInfoProps {
  deviceId: string
}

/**
 * Convert country code to flag emoji
 * Example: "US" -> "🇺🇸", "AE" -> "🇦🇪"
 */
function getCountryFlag(countryCode: string | null): string {
  if (!countryCode) return ""

  // Extract 2-letter country code if it's in format like "United States (US)"
  const match = countryCode.match(/\(([A-Z]{2})\)/)
  let code = match ? match[1] : countryCode.toUpperCase().slice(0, 2)

  // Clean code - only keep A-Z characters
  code = code.replace(/[^A-Z]/g, "").slice(0, 2)

  if (code.length !== 2) return ""

  // Validate that all characters are A-Z
  if (!/^[A-Z]{2}$/.test(code)) return ""

  // Convert country code to flag emoji using Unicode regional indicator symbols
  try {
    const codePoints = code
      .split("")
      .map((char) => {
        const charCode = char.charCodeAt(0)
        // Ensure character is A-Z (65-90)
        if (charCode < 65 || charCode > 90) return null
        return 0x1f1e6 + (charCode - 0x41)
      })
      .filter((cp): cp is number => cp !== null)
      .map((codePoint) => String.fromCodePoint(codePoint))

    if (codePoints.length !== 2) return ""

    return codePoints.join("")
  } catch {
    return ""
  }
}

/**
 * Format date string to readable format
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return "N/A"

  try {
    const date = new Date(dateString)
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return dateString
  }
}

export function DeviceMachineInfo({ deviceId }: DeviceMachineInfoProps) {
  const [machineInfo, setMachineInfo] = useState<MachineInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    const loadMachineInfo = async () => {
      if (!deviceId) return

      setIsLoading(true)
      setError("")

      try {
        const response = await fetch("/api/device-machine-info", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ deviceId }),
        })

        if (response.ok) {
          const data = await response.json()
          setMachineInfo(data)
        } else {
          const errorData = await response.json()
          setError(errorData.error || "Failed to load machine information")
        }
      } catch (error) {
        console.error("Failed to load machine info:", error)
        setError(`Network Error: ${error instanceof Error ? error.message : "Unknown error"}`)
      } finally {
        setIsLoading(false)
      }
    }

    loadMachineInfo()
  }, [deviceId])

  const InfoItem = ({
    icon: Icon,
    label,
    value,
    isPrimary = false,
    showFlag = false,
  }: {
    icon: React.ElementType
    label: string
    value: string | null
    isPrimary?: boolean
    showFlag?: boolean
  }) => {
    const displayValue = value || "N/A"
    const isEmpty = !value
    const flag = showFlag && value ? getCountryFlag(value) : ""

    const content = (
      <div
        className={`flex items-center space-x-2 px-3 py-2.5 rounded-md transition-colors ${
          isPrimary
            ? "bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/30 border border-primary/30"
            : "glass border border-border/50 hover:bg-card/80"
        }`}
      >
        <Icon
          className={`h-4 w-4 shrink-0 ${
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
            className={`text-xs truncate ${
              isPrimary ? "text-foreground font-semibold" : "text-foreground"
            } ${isEmpty ? "text-muted-foreground italic" : ""}`}
          >
            {showFlag && flag ? (
              <span className="flex items-center space-x-1.5">
                <span className="text-base">{flag}</span>
                <span>{value}</span>
              </span>
            ) : (
              displayValue
            )}
          </div>
        </div>
      </div>
    )

    // Wrap with tooltip if text is truncated and value exists
    if (value && value.length > 40) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild className="w-full">
              {content}
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-md break-words glass-card shadow-lg p-3"
            >
              <div className="font-mono text-xs select-text text-foreground">{value}</div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return content
  }

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-2 pt-3 px-4 border-b border-white/5">
          <CardTitle className="text-sm font-normal text-foreground">
            Host Information
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !machineInfo) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-2 pt-3 px-4 border-b border-white/5">
          <CardTitle className="text-sm font-normal text-foreground">
            Host Information
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-xs text-muted-foreground">{error || "Host information not found"}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2 pt-3 px-4 border-b border-white/5">
        <CardTitle className="text-sm font-normal text-foreground">Host Information</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Device ID */}
          <InfoItem icon={Tag} label="Device ID" value={machineInfo.deviceId} isPrimary={true} />

          {/* Stealer Type */}
          <InfoItem icon={Shield} label="Stealer Type" value={machineInfo.stealerType} />

          {/* Operating System */}
          <InfoItem icon={Monitor} label="Operating System" value={machineInfo.os} />

          {/* IP Address */}
          <InfoItem icon={Globe} label="IP Address" value={machineInfo.ipAddress} />

          {/* Username */}
          <InfoItem icon={User} label="Username" value={machineInfo.username} />

          {/* Computer Name / Hostname */}
          <InfoItem icon={Server} label="Computer Name" value={machineInfo.computerName} />

          {/* CPU */}
          <InfoItem icon={Cpu} label="CPU" value={machineInfo.cpu} />

          {/* RAM */}
          <InfoItem icon={HardDrive} label="RAM" value={machineInfo.ram} />

          {/* GPU */}
          <InfoItem icon={Monitor} label="GPU" value={machineInfo.gpu} />

          {/* Country with Flag */}
          <InfoItem icon={MapPin} label="Country" value={machineInfo.country} showFlag={true} />

          {/* Log Date */}
          <InfoItem icon={Calendar} label="Log Date" value={machineInfo.logDate} />

          {/* HWID */}
          <InfoItem icon={Fingerprint} label="HWID" value={machineInfo.hwid} />

          {/* File Path */}
          <InfoItem icon={FolderOpen} label="File Path" value={machineInfo.filePath} />

          {/* Antivirus */}
          <InfoItem icon={Shield} label="Antivirus" value={machineInfo.antivirus} />

          {/* Source File */}
          <InfoItem icon={FileText} label="Source File" value={machineInfo.sourceFile} />

          {/* Created At */}
          <InfoItem icon={Clock} label="Created At" value={formatDate(machineInfo.createdAt)} />
        </div>
      </CardContent>
    </Card>
  )
}

