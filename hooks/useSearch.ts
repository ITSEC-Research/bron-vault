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
}

export function useSearch(): UseSearchReturn {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchType, setSearchType] = useState<"email" | "domain">("email")

  const detectSearchType = (query: string) => {
    if (query.includes("@")) {
      setSearchType("email")
    } else if (query.includes(".")) {
      setSearchType("domain")
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
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
        }),
      })
      
      if (response.ok) {
        const results = await response.json()
        setSearchResults(results)
      } else {
        const errorData = await response.json()
        console.error("Search error:", errorData)
      }
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setIsLoading(false)
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
    handleSearch,
    detectSearchType,
  }
}
