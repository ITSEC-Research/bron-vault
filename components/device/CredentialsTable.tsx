"use client"

import React, { useMemo } from "react"
import { Monitor, Globe, User, Lock, Eye, EyeOff, Copy } from "lucide-react"
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
    return <span className="font-mono text-foreground">{password}</span>
  }

  const firstChar = password.charAt(0)
  const lastChar = password.charAt(password.length - 1)
  const middleLength = password.length - 2
  const masked = firstChar + "*".repeat(middleLength) + lastChar

  return <span className="font-mono text-foreground">{masked}</span>
}

// Simple hover tooltip for manual copy (no auto-copy functionality)
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

  // Jika maxLines diberikan, gunakan line-clamp, jika tidak gunakan truncate
  const containerClass = maxLines === 2
    ? "cursor-default hover:glass-card rounded px-1 py-0.5 transition-colors w-full block line-clamp-2"
    : "cursor-default hover:glass-card rounded px-1 py-0.5 transition-colors w-full block truncate"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={containerClass}>
            {children ||
              (type === "password" ? (
                <span className="font-mono text-foreground">{displayContent}</span>
              ) : (
                <span className="text-foreground">{displayContent}</span>
              ))}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs break-all glass-card border border-border/50 shadow-lg p-3"
        >
          <div className="font-mono text-xs select-text text-foreground">{content}</div>
          <div className="text-xs text-muted-foreground mt-1">Highlight text to copy manually</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// URL Cell with copy functionality
const UrlCell = ({ url }: { url: string }) => {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="truncate max-w-[350px] cursor-pointer hover:glass-card rounded px-1 py-0.5 transition-colors font-mono">
            {url}
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="glass-card border border-border/50 shadow-lg p-3 max-w-md z-50"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Full URL</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigator.clipboard.writeText(url)
                }}
                className="p-1 hover:bg-white/5 rounded transition-colors"
                title="Copy URL"
              >
                <Copy className="h-3 w-3 text-muted-foreground hover:text-blue-500" />
              </button>
            </div>
            <div className="text-xs font-mono text-foreground break-all bg-white/5 p-2 rounded border border-border/50">
              {url}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Copyable Cell Component with hover effect and copy functionality
const CopyableCell = ({ 
  content, 
  label, 
  isPassword = false,
  maxLength,
  children
}: { 
  content: string
  label: string
  isPassword?: boolean
  maxLength?: number
  children?: React.ReactNode
}) => {
  const displayContent = maxLength && content.length > maxLength ? `${content.substring(0, maxLength)}...` : content

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-pointer hover:glass-card rounded px-1 py-0.5 transition-colors w-full block truncate">
            {children || (
              isPassword ? (
                <span className="font-mono text-foreground">{displayContent}</span>
              ) : (
                <span className="text-foreground">{displayContent}</span>
              )
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="glass-card border border-border/50 shadow-lg p-3 max-w-md z-50"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">{label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigator.clipboard.writeText(content)
                }}
                className="p-1 hover:bg-white/5 rounded transition-colors"
                title={`Copy ${label}`}
              >
                <Copy className="h-3 w-3 text-muted-foreground hover:text-blue-500" />
              </button>
            </div>
            <div className={`text-xs ${isPassword ? 'font-mono' : ''} text-foreground break-all bg-white/5 p-2 rounded border border-border/50`}>
              {content}
            </div>
          </div>
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
        <p className="text-foreground">Loading credentials...</p>
      </div>
    )
  }

  if (credentialsError) {
    return (
      <div className="text-center py-8">
        <Alert variant="destructive" className="glass-card border-l-4 border-l-destructive border-destructive">
          <AlertDescription className="text-foreground">{credentialsError}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (deviceCredentials.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <div className="space-y-2">
          <p>No credentials found for this device</p>
          <p className="text-xs">Device ID: {deviceId}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetryCredentials}
            className="glass-card border-border/50 text-foreground hover:bg-white/5"
          >
            Retry Loading
          </Button>
        </div>
      </div>
    )
  }

  const searchBarSection = (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
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
            className="w-full h-9 text-sm glass-card border-border/50 text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPasswords(!showPasswords)}
          className="h-9 px-3 flex items-center space-x-2 shrink-0 glass-card border-border/50 text-foreground hover:bg-white/5"
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
      <div className="glass-card border border-border/50 rounded-lg overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] sm:max-h-[calc(100vh-350px)] pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        <Table className="table-fixed min-w-full">
          <TableHeader>
            <TableRow className="hover:bg-white/5">
              <TableHead className="sticky top-0 z-20 glass-card backdrop-blur-sm text-muted-foreground border-b border-border/50 w-[20%] text-xs h-9 py-2 px-3">
                <div className="flex items-center space-x-1">
                  <Monitor className="h-4 w-4" />
                  <span>Browser</span>
                </div>
              </TableHead>
              <TableHead className="sticky top-0 z-20 glass-card backdrop-blur-sm text-muted-foreground border-b border-border/50 w-[35%] text-xs h-9 py-2 px-3">
                <div className="flex items-center space-x-1">
                  <Globe className="h-4 w-4" />
                  <span>URL</span>
                </div>
              </TableHead>
              <TableHead className="sticky top-0 z-20 glass-card backdrop-blur-sm text-muted-foreground border-b border-border/50 w-[25%] text-xs h-9 py-2 px-3">
                <div className="flex items-center space-x-1">
                  <User className="h-4 w-4" />
                  <span>Username</span>
                </div>
              </TableHead>
              <TableHead className="sticky top-0 z-20 glass-card backdrop-blur-sm text-muted-foreground border-b border-border/50 w-[20%] text-xs h-9 py-2 px-3">
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
                className="border-b border-border/50 hover:bg-white/5"
              >
                <TableCell className="font-medium text-xs py-2 px-3">
                  <HoverableCell content={credential.browser || "Unknown"} maxLines={2} />
                </TableCell>
                <TableCell className="text-xs py-2 px-3 font-mono">
                  <UrlCell url={credential.url} />
                </TableCell>
                <TableCell className="text-xs py-2 px-3">
                  <CopyableCell 
                    content={credential.username} 
                    label="Username"
                    maxLength={35}
                  />
                </TableCell>
                <TableCell className="text-xs py-2 px-3">
                  {showPasswords ? (
                    <CopyableCell 
                      content={credential.password} 
                      label="Password"
                      isPassword={true}
                      maxLength={20}
                    />
                  ) : (
                    <CopyableCell 
                      content={credential.password} 
                      label="Password"
                      isPassword={true}
                      maxLength={20}
                    >
                      <MaskedPassword password={credential.password} />
                    </CopyableCell>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {filteredCredentials.length === 0 && credentialsSearchQuery && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No credentials found matching "{credentialsSearchQuery}"</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCredentialsSearchQuery("")}
            className="mt-2 text-foreground hover:glass-card"
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
      <div className="text-sm text-muted-foreground">
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
            className="w-full h-9 text-sm glass-card border-border/50 text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPasswords(!showPasswords)}
          className="h-9 px-3 flex items-center space-x-2 shrink-0 glass-card border-border/50 text-foreground hover:bg-white/5"
          title={showPasswords ? "Hide passwords" : "Show passwords"}
        >
          {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span className="text-xs">{showPasswords ? "Hide" : "Show"}</span>
        </Button>
      </div>
    </div>
  )
}
