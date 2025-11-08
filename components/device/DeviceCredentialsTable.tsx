"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Monitor, Globe, User, Lock, Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface Credential {
  browser: string | null
  url: string
  username: string
  password: string
  filePath?: string
}

interface DeviceCredentialsTableProps {
  deviceId: string
}

// Fixed MaskedPassword component
const MaskedPassword = ({ password }: { password: string }) => {
  if (!password || password.length <= 2) {
    return <span className="font-mono text-bron-text-primary">{password}</span>
  }

  const firstChar = password.charAt(0)
  const lastChar = password.charAt(password.length - 1)
  const middleLength = password.length - 2
  const masked = firstChar + "*".repeat(middleLength) + lastChar

  return <span className="font-mono text-bron-text-primary">{masked}</span>
}

// Simple hover tooltip for manual copy
const HoverableCell = ({
  content,
  maxLength,
  type = "text",
  children,
  maxLines,
}: {
  content: string
  maxLength?: number
  type?: "text" | "password"
  children?: React.ReactNode
  maxLines?: number
}) => {
  const displayContent = maxLength && content.length > maxLength ? `${content.substring(0, maxLength)}...` : content

  const containerClass = maxLines === 2
    ? "cursor-default hover:bg-bron-bg-tertiary rounded px-1 py-0.5 transition-colors w-full block line-clamp-2"
    : "cursor-default hover:bg-bron-bg-tertiary rounded px-1 py-0.5 transition-colors w-full block truncate"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={containerClass}>
            {children ||
              (type === "password" ? (
                <span className="font-mono text-bron-text-primary">{displayContent}</span>
              ) : (
                <span className="text-bron-text-primary">{displayContent}</span>
              ))}
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

export function DeviceCredentialsTable({ deviceId }: DeviceCredentialsTableProps) {
  const [deviceCredentials, setDeviceCredentials] = useState<Credential[]>([])
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(true)
  const [credentialsError, setCredentialsError] = useState<string>("")
  const [showPasswords, setShowPasswords] = useState(false)
  const [credentialsSearchQuery, setCredentialsSearchQuery] = useState("")

  // Load credentials
  useEffect(() => {
    const loadCredentials = async () => {
      setIsLoadingCredentials(true)
      setCredentialsError("")

      try {
        const response = await fetch("/api/device-credentials", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ deviceId }),
        })

        if (response.ok) {
          const credentials = await response.json()
          setDeviceCredentials(credentials)
        } else {
          const errorData = await response.json()
          setCredentialsError(errorData.error || "Failed to load credentials")
        }
      } catch (error) {
        console.error("Failed to load credentials:", error)
        setCredentialsError(`Network Error: ${error instanceof Error ? error.message : "Unknown error"}`)
      } finally {
        setIsLoadingCredentials(false)
      }
    }

    loadCredentials()
  }, [deviceId])

  const filteredCredentials = useMemo(() => {
    return deviceCredentials.filter((credential) => {
      if (!credentialsSearchQuery.trim()) return true

      const searchLower = credentialsSearchQuery.toLowerCase()
      return (
        credential.username.toLowerCase().includes(searchLower) ||
        credential.url.toLowerCase().includes(searchLower) ||
        (credential.browser && credential.browser.toLowerCase().includes(searchLower))
      )
    })
  }, [deviceCredentials, credentialsSearchQuery])

  if (isLoadingCredentials) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-xs text-bron-text-primary">Loading credentials...</p>
      </div>
    )
  }

  if (credentialsError) {
    return (
      <div className="text-center py-8">
        <Alert variant="destructive" className="bg-bron-accent-red/20 border-bron-accent-red">
          <AlertDescription className="text-xs text-bron-text-primary">{credentialsError}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (deviceCredentials.length === 0) {
    return (
      <div className="text-center py-8 text-bron-text-muted">
        <div className="space-y-2">
          <p className="text-xs">No credentials found for this device</p>
          <p className="text-xs">Device ID: {deviceId}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search Bar Section */}
      <div className="space-y-3">
        <div className="text-sm text-bron-text-muted">
          Found {deviceCredentials.length} credentials for this device
          {credentialsSearchQuery && ` (${filteredCredentials.length} filtered)`}
        </div>
        <div className="flex items-center space-x-3">
          <div className="w-80">
            <Input
              type="text"
              placeholder="Search email or URL..."
              value={credentialsSearchQuery}
              onChange={(e) => setCredentialsSearchQuery(e.target.value)}
              className="w-full h-9 text-sm bg-bron-bg-tertiary border-bron-border text-bron-text-primary placeholder:text-bron-text-muted"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPasswords(!showPasswords)}
            className="h-9 px-3 flex items-center space-x-2 shrink-0 bg-bron-bg-tertiary border-bron-border text-bron-text-primary hover:bg-bron-bg-primary"
            title={showPasswords ? "Hide passwords" : "Show passwords"}
          >
            {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="text-xs">{showPasswords ? "Hide" : "Show"}</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-bron-bg-tertiary border border-bron-border rounded-lg overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
        <Table className="table-fixed min-w-full">
          <TableHeader>
            <TableRow className="hover:bg-bron-bg-primary">
              <TableHead className="sticky top-0 z-20 bg-bron-bg-tertiary text-bron-text-secondary border-b border-bron-border w-[20%] text-xs h-9 py-2 px-3">
                <div className="flex items-center space-x-1">
                  <Monitor className="h-4 w-4" />
                  <span>Browser</span>
                </div>
              </TableHead>
              <TableHead className="sticky top-0 z-20 bg-bron-bg-tertiary text-bron-text-secondary border-b border-bron-border w-[35%] text-xs h-9 py-2 px-3">
                <div className="flex items-center space-x-1">
                  <Globe className="h-4 w-4" />
                  <span>URL</span>
                </div>
              </TableHead>
              <TableHead className="sticky top-0 z-20 bg-bron-bg-tertiary text-bron-text-secondary border-b border-bron-border w-[25%] text-xs h-9 py-2 px-3">
                <div className="flex items-center space-x-1">
                  <User className="h-4 w-4" />
                  <span>Username</span>
                </div>
              </TableHead>
              <TableHead className="sticky top-0 z-20 bg-bron-bg-tertiary text-bron-text-secondary border-b border-bron-border w-[20%] text-xs h-9 py-2 px-3">
                <div className="flex items-center space-x-1">
                  <Lock className="h-4 w-4" />
                  <span>Password</span>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCredentials.map((credential, index) => (
              <TableRow key={index} className="border-b border-bron-border hover:bg-bron-bg-primary">
                <TableCell className="font-medium text-xs py-2 px-3">
                  <HoverableCell content={credential.browser || "Unknown"} maxLines={2} />
                </TableCell>
                <TableCell className="text-xs py-2 px-3">
                  <HoverableCell content={credential.url} maxLength={50} />
                </TableCell>
                <TableCell className="text-xs py-2 px-3">
                  <HoverableCell content={credential.username} maxLength={35} />
                </TableCell>
                <TableCell className="text-xs py-2 px-3">
                  {showPasswords ? (
                    <HoverableCell content={credential.password} maxLength={20} type="password" />
                  ) : (
                    <HoverableCell content={credential.password} maxLength={20} type="password">
                      <MaskedPassword password={credential.password} />
                    </HoverableCell>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredCredentials.length === 0 && credentialsSearchQuery && (
        <div className="text-center py-8 text-bron-text-muted">
          <p>No credentials found matching "{credentialsSearchQuery}"</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCredentialsSearchQuery("")}
            className="mt-2 text-bron-text-primary hover:bg-bron-bg-tertiary"
          >
            Clear search
          </Button>
        </div>
      )}
    </div>
  )
}

