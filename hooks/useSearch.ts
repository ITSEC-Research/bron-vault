import { useState } from "react"

interface SearchResult {
  deviceId: string
  deviceName: string
  uploadBatch: string
  matchingFiles: string[]
  matchedContent: string[]
  files: any[]
  totalFiles: number
  upload_date?: string
  uploadDate?: string
  logDate?: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

interface UseSearchReturn {
  searchQuery: string
  setSearchQuery: (query: string) => void
  searchResults: SearchResult[]
  setSearchResults: (results: SearchResult[]) => void
  isLoading: boolean
  searchType: "email" | "domain"
  setSearchType: (type: "email" | "domain") => void
  handleSearch: () => Promise<void>
  detectSearchType: (query: string) => void
  loadMore: () => Promise<void>
  pagination: PaginationInfo | null
  totalDevices: number
  hasSearched: boolean
}

export function useSearch(): UseSearchReturn {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchType, setSearchType] = useState<"email" | "domain">("email")
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const detectSearchType = (query: string) => {
    if (query.includes("@")) {
      setSearchType("email")
    } else if (query.includes(".")) {
      setSearchType("domain")
    }
  }

  const handleSearch = async (reset = true) => {
    if (!searchQuery.trim()) return
    
    const currentPage = reset ? 1 : page + 1
    
    setIsLoading(true)
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchQuery,
          type: searchType,
          page: currentPage,
          limit: 50,
        }),
      })
      
      if (response.ok) {
        const data = await response.json()
        
        if (reset) {
          // New search: replace results
          setSearchResults(data.devices || [])
          setPage(1)
          setHasSearched(true) // Mark that search has been executed
        } else {
          // Load more: append results
          setSearchResults(prev => [...prev, ...(data.devices || [])])
          setPage(currentPage)
        }
        
        setPagination(data.pagination || null)
      } else {
        const errorData = await response.json()
        console.error("Search error:", errorData)
        if (reset) {
          setHasSearched(true) // Mark as searched even on error
        }
      }
    } catch (error) {
      console.error("Search error:", error)
      if (reset) {
        setHasSearched(true) // Mark as searched even on error
      }
    } finally {
      setIsLoading(false)
    }
  }

  const loadMore = async () => {
    if (pagination?.hasMore && !isLoading) {
      await handleSearch(false)
    }
  }

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    isLoading,
    searchType,
    setSearchType,
    handleSearch: () => handleSearch(true),
    detectSearchType,
    loadMore,
    pagination,
    totalDevices: pagination?.total || 0,
    hasSearched,
  }
}
