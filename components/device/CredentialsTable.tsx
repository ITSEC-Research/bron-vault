"use client"

import React, { useMemo } from "react"
import { Monitor, Globe, User, Lock, Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface Credential {
  browser: string
  url: string
  username: string
  password: string
  filePath?: string
}

interface CredentialsTableProps {
  deviceCredentials: Credential[]
  isLoadingCredentials: boolean
  credentialsError: string
  showPasswords: boolean
  setShowPasswords: (show: boolean) => void
  credentialsSearchQuery: string
  setCredentialsSearchQuery: (query: string) => void
  onRetryCredentials: () => void
  deviceId: string
  hideSearchBar?: boolean
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

// Simple hover tooltip for manual copy (no auto-copy functionality)
const HoverableCell = ({
  content,
  maxLength,
  type = "text",
  children,
}: {
  content: string
  maxLength?: number
  type?: "text" | "password"
  children?: React.ReactNode
}) => {
  const displayContent = maxLength && content.length > maxLength ? `${content.substring(0, maxLength)}...` : content

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default hover:bg-bron-bg-tertiary rounded px-1 py-0.5 transition-colors">
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

export function CredentialsTable({
  deviceCredentials,
  isLoadingCredentials,
  credentialsError,
  showPasswords,
  setShowPasswords,
  credentialsSearchQuery,
  setCredentialsSearchQuery,
  onRetryCredentials,
  deviceId,
  hideSearchBar = false,
}: CredentialsTableProps) {
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
        <p className="text-bron-text-primary">Loading credentials...</p>
      </div>
    )
  }

  if (credentialsError) {
    return (
      <div className="text-center py-8">
        <Alert variant="destructive" className="bg-bron-accent-red/20 border-bron-accent-red">
          <AlertDescription className="text-bron-text-primary">{credentialsError}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (deviceCredentials.length === 0) {
    return (
      <div className="text-center py-8 text-bron-text-muted">
        <div className="space-y-2">
          <p>No credentials found for this device</p>
          <p className="text-xs">Device ID: {deviceId}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetryCredentials}
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
  )

  return (
    <div className="space-y-4">
      {!hideSearchBar && searchBarSection}
      <div className="bg-bron-bg-tertiary border border-bron-border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-bron-bg-primary">
              <TableHead className="sticky top-0 z-20 bg-bron-bg-tertiary w-[150px] text-bron-text-secondary border-b border-bron-border">
                <div className="flex items-center space-x-1">
                  <Monitor className="h-4 w-4" />
                  <span>Browser</span>
                </div>
              </TableHead>
              <TableHead className="sticky top-0 z-20 bg-bron-bg-tertiary text-bron-text-secondary border-b border-bron-border">
                <div className="flex items-center space-x-1">
                  <Globe className="h-4 w-4" />
                  <span>URL</span>
                </div>
              </TableHead>
              <TableHead className="sticky top-0 z-20 bg-bron-bg-tertiary text-bron-text-secondary border-b border-bron-border">
                <div className="flex items-center space-x-1">
                  <User className="h-4 w-4" />
                  <span>Username</span>
                </div>
              </TableHead>
              <TableHead className="sticky top-0 z-20 bg-bron-bg-tertiary text-bron-text-secondary border-b border-bron-border">
                <div className="flex items-center space-x-1">
                  <Lock className="h-4 w-4" />
                  <span>Password</span>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCredentials.map((credential, index) => (
              <TableRow
                key={index}
                className="border-b border-bron-border hover:bg-bron-bg-primary"
              >
                <TableCell className="font-medium text-sm">
                  <HoverableCell content={credential.browser || "Unknown"} />
                </TableCell>
                <TableCell className="text-sm">
                  <HoverableCell content={credential.url} maxLength={30} />
                </TableCell>
                <TableCell className="text-sm">
                  <HoverableCell content={credential.username} maxLength={20} />
                </TableCell>
                <TableCell className="text-sm">
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

// Export search bar section for use outside ScrollArea
export function CredentialsSearchBar({
  deviceCredentials,
  credentialsSearchQuery,
  setCredentialsSearchQuery,
  showPasswords,
  setShowPasswords,
  filteredCount,
}: {
  deviceCredentials: Credential[]
  credentialsSearchQuery: string
  setCredentialsSearchQuery: (query: string) => void
  showPasswords: boolean
  setShowPasswords: (show: boolean) => void
  filteredCount: number
}) {
  return (
    <div className="space-y-3 mb-4">
      <div className="text-sm text-bron-text-muted">
        Found {deviceCredentials.length} credentials for this device
        {credentialsSearchQuery && ` (${filteredCount} filtered)`}
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
  )
}
