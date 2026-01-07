"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Key, Eye, EyeOff, Globe, User, Lock, Calendar, ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, Copy, HardDrive } from "lucide-react"
import { LoadingState } from "@/components/ui/loading"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useRouter } from "next/navigation"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface CredentialItem {
  id: number
  url: string
  username: string
  password: string
  browser: string
  deviceId: string
  deviceName: string
  createdAt: string
  logDate: string | null
}

interface CredentialsTabProps {
  targetDomain: string
  searchType?: 'domain' | 'keyword'
  keywordMode?: 'domain-only' | 'full-url'
}

// --- Helper function to mask password ---
const maskPassword = (password: string) => {
  if (!password) return ""
  return "•".repeat(Math.min(password.length, 20))
}

// --- Copyable Cell Component with hover effect and copy functionality ---
// FIX: Moved outside component to prevent remounting and UX bugs
const CopyableCell = ({ 
  content, 
  label, 
  isPassword = false,
  isMasked = false,
  itemId
}: { 
  content: string
  label: string
  isPassword?: boolean
  isMasked?: boolean
  itemId?: number
}) => {
  const displayContent = isMasked 
    ? maskPassword(content || "") // Safety check if content null
    : (content || "")
    
  const tooltipKey = itemId ? `copyable-${itemId}-${label}` : `copyable-${label}`
  
  return (
    <TooltipProvider key={tooltipKey} delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-pointer hover:glass-card rounded px-1 py-0.5 transition-colors w-full block truncate min-w-0">
            {isPassword ? (
              <span className="font-mono text-foreground">{displayContent}</span>
            ) : (
              <span className="text-foreground">{displayContent}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="glass-card border border-border/50 shadow-lg p-3 max-w-md z-50"
        >
          <div className="space-y-2">
            <div key={`${tooltipKey}-header`} className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">{label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  navigator.clipboard.writeText(content || "")
                }}
                className="p-1 hover:bg-white/5 rounded transition-colors"
                title={`Copy ${label}`}
              >
                <Copy className="h-3 w-3 text-muted-foreground hover:text-blue-500" />
              </button>
            </div>
            <div key={`${tooltipKey}-content`} className={`text-xs ${isPassword ? 'font-mono' : ''} text-foreground break-all bg-white/5 p-2 rounded border border-border/50`}>
              {content || "-"}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function CredentialsTab({ targetDomain, searchType = 'domain', keywordMode }: CredentialsTabProps) {
  const router = useRouter()
  const [data, setData] = useState<CredentialItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showPasswords, setShowPasswords] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<'created_at' | 'url' | 'username' | 'log_date' | 'device_id'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [jumpToPage, setJumpToPage] = useState("")
  const [limit, setLimit] = useState(50)
  const prevSearchQueryRef = useRef<string>("")

  // Reset to page 1 when search query changes (but not on initial mount)
  useEffect(() => {
    if (prevSearchQueryRef.current !== "" && prevSearchQueryRef.current !== searchQuery) {
      setPage(1)
    }
    prevSearchQueryRef.current = searchQuery
  }, [searchQuery])

  // Reset to page 1 when limit changes
  useEffect(() => {
    if (page !== 1) {
      setPage(1)
    }
  }, [limit])

  useEffect(() => {
    loadData()
  }, [targetDomain, page, sortBy, sortOrder, searchQuery, limit, searchType, keywordMode])

  const loadData = async () => {
    if (!targetDomain || !targetDomain.trim()) {
      console.warn("⚠️ No target domain provided")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      console.log("🔄 Loading credentials for:", searchType, targetDomain, "mode:", keywordMode, "search:", searchQuery)
      const body: any = {
        targetDomain,
        searchType,
        searchQuery: searchQuery.trim() || undefined,
        pagination: {
          page,
          limit,
          sortBy,
          sortOrder,
        },
      }
      if (searchType === 'keyword' && keywordMode) {
        body.keywordMode = keywordMode
      }
      const response = await fetch("/api/domain-recon/credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      console.log("📡 Response status:", response.status, response.ok)

      if (response.ok) {
        const result = await response.json()
        console.log("📥 Credentials data received:", {
          credentials: result.credentials?.length || 0,
          pagination: result.pagination,
          success: result.success,
          targetDomain: result.targetDomain,
          sample: result.credentials?.slice(0, 2),
          sampleUsernames: result.credentials?.slice(0, 5).map((c: any) => ({
            id: c.id,
            username: c.username,
            url: c.url?.substring(0, 50)
          })),
          fullResult: result,
        })
        
        if (result.success && Array.isArray(result.credentials)) {
          // Debug: Check username values before setting data
          const credentialsWithUsernameCheck = result.credentials.map((cred: any) => {
            if (!cred.username && cred.url) {
              console.warn("⚠️ Empty username in credential:", {
                id: cred.id,
                url: cred.url?.substring(0, 50),
                hasUsername: !!cred.username,
                usernameValue: cred.username,
                allKeys: Object.keys(cred)
              })
            }
            return cred
          })
          
          setData(credentialsWithUsernameCheck)
          setTotalPages(result.pagination?.totalPages || 1)
          setTotal(result.pagination?.total || 0)
        } else {
          console.warn("⚠️ Response not successful or credentials not an array:", result)
          setData([])
          setTotalPages(1)
          setTotal(0)
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error("❌ Credentials API error:", response.status, errorData)
        setData([])
        setTotalPages(1)
        setTotal(0)
      }
    } catch (error) {
      console.error("❌ Error loading credentials:", error)
      setData([])
      setTotalPages(1)
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }


  const handleSort = (column: 'created_at' | 'url' | 'username' | 'log_date' | 'device_id') => {
    if (sortBy === column) {
      // Toggle sort order if same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new column and default to desc
      setSortBy(column)
      setSortOrder('desc')
    }
    // Reset to first page when sorting changes
    setPage(1)
  }

  const getSortIcon = (column: 'created_at' | 'url' | 'username' | 'log_date' | 'device_id') => {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground" />
    }
    if (sortOrder === 'asc') {
      return <ArrowUp className="h-3 w-3 ml-1 text-primary" />
    }
    return <ArrowDown className="h-3 w-3 ml-1 text-primary" />
  }

  const formatLogDate = (logDate: string | null): string => {
    if (!logDate) return "N/A"
    
    try {
      // Normalize log_date to standard format before displaying
      // Handles formats like:
      // - "28.06.2025 12:28:40" (DD.MM.YYYY HH:MM:SS)
      // - "19/07/2025 16:02:13" (DD/MM/YYYY HH:MM:SS)
      // - "2025-06-28 12:28:40" (YYYY-MM-DD HH:MM:SS)
      // - "28.06.2025" (DD.MM.YYYY)
      // - "19/07/2025" (DD/MM/YYYY)
      
      let date: Date | null = null
      const trimmedDate = logDate.trim()
      
      // Extract date part (remove time if present)
      const datePart = trimmedDate.split(' ')[0]
      
      // Try DD/MM/YYYY format (with or without time)
      const ddmmyyyySlash = datePart.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      if (ddmmyyyySlash) {
        const [, day, month, year] = ddmmyyyySlash
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      }
      
      // Try DD.MM.YYYY format (with or without time)
      if (!date || isNaN(date.getTime())) {
        const ddmmyyyyDot = datePart.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
        if (ddmmyyyyDot) {
          const [, day, month, year] = ddmmyyyyDot
          date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        }
      }
      
      // Try YYYY-MM-DD format (with or without time)
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
      
      // Fallback: try native Date parsing
      if (!date || isNaN(date.getTime())) {
        date = new Date(trimmedDate)
      }
      
      // Validate and format
      if (date && !isNaN(date.getTime())) {
        // Return normalized format: "DD MMM YYYY" (e.g., "28 Jun 2025")
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      }
      
      // If all parsing fails, return original value
      return logDate
    } catch {
      // On error, return original value
      return logDate
    }
  }

  // Calculate which page numbers to display (always 7 elements)
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = []
    
    if (totalPages <= 7) {
      // Show all pages if total is 7 or less
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show 7 elements
      // Page 1-4: 1 2 3 4 5 6 ... 59
      if (page <= 4) {
        for (let i = 1; i <= 6; i++) {
          pages.push(i)
        }
        pages.push('ellipsis-end')
        pages.push(totalPages)
      }
      // Near the end (last 5 pages): 1 ... 54 55 56 57 58 59
      else if (page >= totalPages - 4) {
        pages.push(1)
        pages.push('ellipsis-start')
        for (let i = totalPages - 5; i <= totalPages; i++) {
          pages.push(i)
        }
      }
      // Page 5+ (middle): 1 ... 3 4 5 6 7 ... 59
      else {
        pages.push(1)
        pages.push('ellipsis-start')
        
        // Calculate window around current page (5 pages)
        let start = Math.max(3, page - 2)
        let end = Math.min(totalPages - 1, start + 4)
        
        // Adjust if near the end
        if (end >= totalPages - 1) {
          end = totalPages - 1
          start = Math.max(3, end - 4)
        }
        
        // Add 5 pages in window
        for (let i = start; i <= end; i++) {
          pages.push(i)
        }
        
        pages.push('ellipsis-end')
        pages.push(totalPages)
      }
    }
    
    return pages
  }

  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage)
    if (pageNum >= 1 && pageNum <= totalPages) {
      setPage(pageNum)
      setJumpToPage("")
    }
  }

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="!p-4">
        <CardTitle className="flex items-center text-foreground text-lg">
          <Key className="h-4 w-4 mr-2 text-emerald-500" />
          Credentials
        </CardTitle>
      </CardHeader>
      <CardContent className="!p-4 !pt-0">
        {/* Search and Actions */}
        <div className="mb-4 space-y-3">
          <div className="text-sm text-muted-foreground">
            Found {total} credentials{searchQuery && ` matching "${searchQuery}"`}
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-80">
              <Input
                type="text"
                placeholder="Search URL, username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 text-sm glass-card border-border/50 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPasswords(!showPasswords)}
              className="h-9 px-3 flex items-center space-x-2 shrink-0 glass-card border-border/50 text-foreground hover:bg-white/5"
            >
              {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="text-xs">{showPasswords ? "Hide" : "Show"}</span>
            </Button>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="py-8">
            <LoadingState 
              type="data" 
              message="Loading credentials data..." 
              size="md"
            />
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">
              {searchQuery ? `No credentials found matching "${searchQuery}"` : "No credentials found for this search"}
            </p>
          </div>
        ) : (
          <>
            <div className="glass-card border border-border/50 rounded-lg overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)] pb-4">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow className="hover:bg-white/5">
                    <TableHead 
                      className="sticky top-0 z-20 glass-card backdrop-blur-sm text-muted-foreground border-b border-border/50 text-xs h-9 py-2 px-3 cursor-pointer hover:bg-white/5 transition-colors w-[35%]"
                      onClick={() => handleSort('url')}
                    >
                      <div className="flex items-center space-x-1">
                        <Globe className="h-4 w-4 shrink-0" />
                        <span>URL</span>
                        {getSortIcon('url')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="sticky top-0 z-20 glass-card backdrop-blur-sm text-muted-foreground border-b border-border/50 text-xs h-9 py-2 px-3 cursor-pointer hover:bg-white/5 transition-colors w-[16%]"
                      onClick={() => handleSort('username')}
                    >
                      <div className="flex items-center space-x-1">
                        <User className="h-4 w-4 shrink-0" />
                        <span>Username</span>
                        {getSortIcon('username')}
                      </div>
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 glass-card backdrop-blur-sm text-muted-foreground border-b border-border/50 text-xs h-9 py-2 px-3 w-[16%]">
                      <div className="flex items-center space-x-1">
                        <Lock className="h-4 w-4 shrink-0" />
                        <span>Password</span>
                      </div>
                    </TableHead>
                    <TableHead 
                      className="sticky top-0 z-20 glass-card backdrop-blur-sm text-muted-foreground border-b border-border/50 text-xs h-9 py-2 px-3 cursor-pointer hover:bg-white/5 transition-colors w-[13%]"
                      onClick={() => handleSort('log_date')}
                    >
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4 shrink-0" />
                        <span>Log Date</span>
                        {getSortIcon('log_date')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="sticky top-0 z-20 glass-card backdrop-blur-sm text-muted-foreground border-b border-border/50 text-xs h-9 py-2 px-3 cursor-pointer hover:bg-white/5 transition-colors text-left w-[18%]"
                      onClick={() => handleSort('device_id')}
                    >
                      <div className="flex items-center space-x-1">
                        <HardDrive className="h-4 w-4 shrink-0" />
                        <span>Device</span>
                        {getSortIcon('device_id')}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow
                      key={item.id}
                      className="border-b border-border/50 hover:bg-white/5"
                    >
                      <TableCell className="text-xs py-2 px-3 font-mono w-[35%]">
                        <TooltipProvider key={`url-tooltip-${item.id}`} delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="truncate max-w-[350px] cursor-pointer hover:glass-card rounded px-1 py-0.5 transition-colors">
                                {item.url}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent 
                              side="top" 
                              className="glass-card border border-border/50 shadow-lg p-3 max-w-md z-50"
                            >
                              <div className="space-y-2">
                                <div key={`url-header-${item.id}`} className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-muted-foreground">Full URL</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      navigator.clipboard.writeText(item.url)
                                    }}
                                    className="p-1 hover:bg-white/5 rounded transition-colors"
                                    title="Copy URL"
                                  >
                                    <Copy className="h-3 w-3 text-muted-foreground hover:text-blue-500" />
                                  </button>
                                </div>
                                <div key={`url-content-${item.id}`} className="text-xs font-mono text-foreground break-all bg-white/5 p-2 rounded border border-border/50">
                                  {item.url}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-xs py-2 px-3 w-[16%]">
                        <CopyableCell 
                          content={item.username} 
                          label="Username"
                          itemId={item.id}
                        />
                      </TableCell>
                      <TableCell className="text-xs py-2 px-3 font-mono w-[16%]">
                        {showPasswords ? (
                          <CopyableCell 
                            content={item.password} 
                            label="Password"
                            isPassword={true}
                            itemId={item.id}
                          />
                        ) : (
                          <CopyableCell 
                            content={item.password} 
                            label="Password"
                            isPassword={true}
                            isMasked={true}
                            itemId={item.id}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-xs py-2 px-3 w-[13%] whitespace-nowrap">
                        <div className="truncate" title={formatLogDate(item.logDate)}>
                          {formatLogDate(item.logDate)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs py-2 px-3 text-left w-[18%]">
                        <TooltipProvider key={`device-tooltip-${item.id}`} delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => router.push(`/device/${item.deviceId}`)}
                                className="text-blue-500 hover:underline text-left truncate block w-full cursor-pointer hover:glass-card rounded px-1 py-0.5 transition-colors"
                              >
                                {item.deviceName || item.deviceId}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent 
                              side="top" 
                              className="glass-card border border-border/50 shadow-lg p-3 max-w-md z-50"
                            >
                              <div className="text-xs font-mono text-foreground break-all">
                                {item.deviceName || item.deviceId}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Page size selector and Pagination */}
            <div className="mt-4">
              <div className="flex items-center w-full">
                {/* LEFT COLUMN: Page Size Selector */}
                <div className="flex-1 flex items-center justify-start space-x-2 text-sm text-muted-foreground">
                  <span className="text-xs whitespace-nowrap">Show</span>
                  <Select
                    value={limit.toString()}
                    onValueChange={(value) => setLimit(Number(value))}
                  >
                    <SelectTrigger className="h-8 w-20 text-xs glass-card border-border/50 text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="75">75</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs whitespace-nowrap">per page</span>
                </div>
                {/* MIDDLE COLUMN: Pagination */}
                <div className="flex items-center justify-center">
                  {totalPages > 1 && (
                    <Pagination className="w-auto mx-0">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => page > 1 && setPage(page - 1)}
                            className={page === 1 ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                        {getPageNumbers().map((pageNum, index) => {
                          if (pageNum === 'ellipsis-start' || pageNum === 'ellipsis-end') {
                            return (
                              <PaginationItem key={`ellipsis-${index}`}>
                                <span className="px-2 text-muted-foreground">
                                  <MoreHorizontal className="h-4 w-4" />
                                </span>
                              </PaginationItem>
                            )
                          }
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                onClick={() => setPage(pageNum)}
                                isActive={page === pageNum}
                                className="cursor-pointer"
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        })}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => page < totalPages && setPage(page + 1)}
                            className={page === totalPages ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </div>
                {/* RIGHT COLUMN: Jump to Page */}
                <div className="flex-1 flex items-center justify-end gap-2">
                  {totalPages > 1 && (
                    <>
                      {/* Separator */}
                      <div className="h-5 w-[1px] bg-border/50" />
                      {/* Jump to page */}
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <span className="text-xs whitespace-nowrap">Page</span>
                        <Input
                          type="number"
                          min="1"
                          max={totalPages}
                          value={jumpToPage}
                          onChange={(e) => setJumpToPage(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleJumpToPage()
                            }
                          }}
                          placeholder=""
                          className="w-16 h-8 text-sm glass-card border-border/50 text-foreground"
                        />
                        <span className="text-xs whitespace-nowrap">of {totalPages}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleJumpToPage}
                          className="h-8 px-2 text-xs glass-card border-border/50 text-foreground hover:bg-white/5"
                        >
                          Go
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

