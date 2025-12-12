"use client"

import { useState, useEffect, useMemo } from "react"
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
import { Globe, Link, ArrowUpDown, ArrowUp, ArrowDown, Filter, MoreHorizontal, Key } from "lucide-react"
import { LoadingState, LoadingTable } from "@/components/ui/loading"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface SubdomainItem {
  fullHostname: string
  path: string
  credentialCount: number
}

interface SubdomainsTabProps {
  targetDomain: string
  searchType?: 'domain' | 'keyword'
  keywordMode?: 'domain-only' | 'full-url'
}

export function SubdomainsTab({ targetDomain, searchType = 'domain', keywordMode }: SubdomainsTabProps) {
  const [data, setData] = useState<SubdomainItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [sortBy, setSortBy] = useState<'full_hostname' | 'path' | 'credential_count'>('credential_count')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [deduplicate, setDeduplicate] = useState(false)
  const [jumpToPage, setJumpToPage] = useState("")
  const [limit, setLimit] = useState(50)

  // Reset to page 1 when limit changes
  useEffect(() => {
    if (page !== 1) {
      setPage(1)
    }
  }, [limit])

  useEffect(() => {
    loadData()
  }, [targetDomain, page, sortBy, sortOrder, limit, searchType, keywordMode])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const body: any = {
        targetDomain,
        searchType,
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
      const response = await fetch("/api/domain-recon/subdomains", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const result = await response.json()
        console.log("📥 Subdomains data received:", {
          subdomains: result.subdomains?.length || 0,
          pagination: result.pagination,
          success: result.success,
        })
        setData(result.subdomains || [])
        setTotalPages(result.pagination?.totalPages || 1)
        setTotal(result.pagination?.total || 0)
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error("❌ Subdomains API error:", response.status, errorData)
      }
    } catch (error) {
      console.error("Error loading subdomains:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredData = useMemo(() => {
    let filtered = data

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (item) =>
          item.fullHostname.toLowerCase().includes(query) ||
          item.path.toLowerCase().includes(query)
      )
    }

    // Apply deduplication if enabled (deduplicate by fullHostname only)
    if (deduplicate) {
      const subdomainMap = new Map<string, SubdomainItem>()
      
      filtered.forEach((item) => {
        const existing = subdomainMap.get(item.fullHostname)
        if (existing) {
          // Aggregate credential count and keep the first path (or could show "Multiple paths")
          subdomainMap.set(item.fullHostname, {
            ...existing,
            credentialCount: existing.credentialCount + item.credentialCount,
            // Keep path as is, or could show aggregated info
          })
        } else {
          subdomainMap.set(item.fullHostname, { ...item })
        }
      })
      
      filtered = Array.from(subdomainMap.values())
    }

    return filtered
  }, [data, searchQuery, deduplicate])

  const handleSort = (column: 'full_hostname' | 'path' | 'credential_count') => {
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

  const getSortIcon = (column: 'full_hostname' | 'path' | 'credential_count') => {
    if (sortBy !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground" />
    }
    if (sortOrder === 'asc') {
      return <ArrowUp className="h-3 w-3 ml-1 text-primary" />
    }
    return <ArrowDown className="h-3 w-3 ml-1 text-primary" />
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
          <Globe className="h-4 w-4 mr-2 text-blue-500" />
          Subdomains & Paths
        </CardTitle>
      </CardHeader>
      <CardContent className="!p-4 !pt-0">
        {/* Search and Deduplication */}
        <div className="mb-4 space-y-3">
          <div className="text-sm text-muted-foreground">
            Found {total} entries
            {deduplicate && ` (${filteredData.length} unique subdomains)`}
            {searchQuery && !deduplicate && ` (${filteredData.length} filtered)`}
            {searchQuery && deduplicate && ` (${filteredData.length} unique filtered)`}
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-80">
              <Input
                type="text"
                placeholder="Search subdomain or path..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 text-sm glass-card border-border/50 text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeduplicate(!deduplicate)}
              className={`h-9 px-3 flex items-center space-x-2 shrink-0 border-border/50 text-foreground hover:bg-white/5 ${
                deduplicate
                  ? "bg-primary/20 border-primary text-primary"
                  : "glass-card"
              }`}
              title={deduplicate ? "Show all entries" : "Show unique subdomains only"}
            >
              <Filter className="h-4 w-4" />
              <span className="text-xs">{deduplicate ? "Show All" : "Deduplicate"}</span>
            </Button>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="py-8">
            <LoadingState 
              type="data" 
              message="Loading subdomains data..." 
              size="md"
            />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">No data available for this search</p>
          </div>
        ) : (
          <>
            <div className="glass-card border border-border/50 rounded-lg overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)] pb-4">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-white/5">
                    <TableHead 
                      className="sticky top-0 z-20 glass-card backdrop-blur-sm text-muted-foreground border-b border-border/50 text-xs h-9 py-2 px-3 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => handleSort('full_hostname')}
                    >
                      <div className="flex items-center space-x-1">
                        <Globe className="h-4 w-4" />
                        <span>Subdomain</span>
                        {getSortIcon('full_hostname')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="sticky top-0 z-20 glass-card backdrop-blur-sm text-muted-foreground border-b border-border/50 text-xs h-9 py-2 px-3 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => handleSort('path')}
                    >
                      <div className="flex items-center space-x-1">
                        <Link className="h-4 w-4" />
                        <span>Path</span>
                        {getSortIcon('path')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="sticky top-0 z-20 glass-card backdrop-blur-sm text-muted-foreground border-b border-border/50 text-xs h-9 py-2 px-3 cursor-pointer hover:bg-white/5 transition-colors text-center"
                      onClick={() => handleSort('credential_count')}
                    >
                      <div className="flex items-center justify-center space-x-1">
                        <Key className="h-4 w-4 shrink-0" />
                        <span>Credential Count</span>
                        {getSortIcon('credential_count')}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item, index) => (
                    <TableRow
                      key={index}
                      className="border-b border-border/50 hover:bg-white/5"
                    >
                      <TableCell className="font-medium text-xs py-2 px-3 font-mono">
                        {item.fullHostname || targetDomain}
                      </TableCell>
                      <TableCell className="text-xs py-2 px-3 font-mono">
                        {item.path || "/"}
                      </TableCell>
                      <TableCell className="text-xs py-2 px-3 text-center">
                        {item.credentialCount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Page size selector and Pagination */}
            <div className="mt-4">
              <div className="flex items-center w-full">
                {/* KOLOM KIRI: Page Size Selector */}
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
                {/* KOLOM TENGAH: Pagination */}
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
                {/* KOLOM KANAN: Jump to Page */}
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

