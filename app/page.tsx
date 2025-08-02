"use client"
export const dynamic = "force-dynamic"

import React, { useState, useEffect } from "react"
import { Database, Folder, FileText, Eye, File, ImageIcon, Book, Package } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

// Import our new components
import { SearchInterface } from "@/components/search/SearchInterface"
import { TypingEffect } from "@/components/search/TypingEffect"
import { SearchResults } from "@/components/search/SearchResults"
import { DeviceDetailsPanel } from "@/components/device/DeviceDetailsPanel"
import { FileContentDialog } from "@/components/file/FileContentDialog"

// Import custom hooks
import { useStats } from "@/hooks/useStats"
import { useSearch } from "@/hooks/useSearch"

// Type definitions
interface StoredFile {
  file_path: string
  file_name: string
  parent_path: string
  is_directory: boolean
  file_size?: number
  has_content: boolean
}

interface TreeNode {
  name: string
  path: string
  isDirectory: boolean
  children: TreeNode[]
  file?: StoredFile
  isMatching?: boolean
  hasMatch?: boolean
  hasContent?: boolean
  size?: number
  level?: number
}

interface SearchResult {
  deviceId: string
  deviceName: string
  uploadBatch: string
  matchingFiles: string[]
  matchedContent: string[]
  files: StoredFile[]
  totalFiles: number
  upload_date?: string
  uploadDate?: string
}

interface Credential {
  browser: string
  url: string
  username: string
  password: string
  filePath?: string
}



export default function SearchPage() {
  // Use custom hooks for state management
  const { stats, topPasswords, isStatsLoaded, statsError } = useStats()
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isLoading,
    searchType,
    setSearchType,
    handleSearch,
    detectSearchType
  } = useSearch()

  // Local state for UI components
  const [selectedDevice, setSelectedDevice] = useState<SearchResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<{ deviceId: string; filePath: string; fileName: string } | null>(null)
  const [fileContent, setFileContent] = useState<string>("")
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [deviceCredentials, setDeviceCredentials] = useState<Credential[]>([])
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false)
  const [credentialsError, setCredentialsError] = useState<string>("")
  const [showPasswords, setShowPasswords] = useState(false)
  const [credentialsSearchQuery, setCredentialsSearchQuery] = useState("")
  const [selectedFileType, setSelectedFileType] = useState<'text' | 'image' | null>(null)
  const [searchActive, setSearchActive] = useState(false)

  // Load credentials when device is selected and reset password visibility
  useEffect(() => {
    if (selectedDevice) {
      console.log("🔄 Device selected, loading credentials for:", selectedDevice.deviceId)
      setShowPasswords(false) // Reset password visibility for each device
      setCredentialsSearchQuery("") // Reset search query for each device
      loadDeviceCredentials(selectedDevice.deviceId)
    }
  }, [selectedDevice])

  // Prepare typing sentences for the typing effect
  const totalCreds =
    typeof stats.totalCredentials === "number" &&
    isFinite(stats.totalCredentials) &&
    !isNaN(stats.totalCredentials) &&
    stats.totalCredentials > 0
      ? stats.totalCredentials
      : null

  const validDevices = typeof stats.totalDevices === 'number' && !isNaN(stats.totalDevices)
  const validFiles = typeof stats.totalFiles === 'number' && !isNaN(stats.totalFiles)
  const validDomains = typeof stats.totalDomains === 'number' && !isNaN(stats.totalDomains)
  const validUrls = typeof stats.totalUrls === 'number' && !isNaN(stats.totalUrls)
  const validCreds = typeof totalCreds === 'number' && !isNaN(totalCreds)

  const typingSentences = isStatsLoaded && validDevices && validFiles && validDomains && validUrls && validCreds
    ? [
        `${stats.totalDevices} compromised devices, ${stats.totalFiles} files extracted.`,
        `${stats.totalDomains} total domains, ${stats.totalUrls} total urls.`,
        `${totalCreds} records ready to query...`,
      ]
    : []



  // Load device credentials function
  const loadDeviceCredentials = async (deviceId: string) => {
    console.log("🚀 Starting to load credentials for device:", deviceId)
    setIsLoadingCredentials(true)
    setCredentialsError("")
    setDeviceCredentials([]) // Clear previous data

    try {
      console.log("📡 Making API call to /api/device-credentials")
      const response = await fetch("/api/device-credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId }),
      })

      console.log("📡 API Response status:", response.status)
      console.log("📡 API Response ok:", response.ok)

      if (response.ok) {
        const credentials = await response.json()
        console.log("✅ API returned credentials:", credentials)
        console.log("📊 Number of credentials received:", credentials.length)

        if (credentials.length > 0) {
          console.log("📝 Sample credential:", credentials[0])
        }

        setDeviceCredentials(credentials)
      } else {
        const errorData = await response.json()
        console.error("❌ API Error:", errorData)
        setCredentialsError(`API Error: ${errorData.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("❌ Failed to load credentials:", error)
      setCredentialsError(`Network Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsLoadingCredentials(false)
      console.log("🏁 Finished loading credentials")
    }
  }

  // Handle search with typing effect control
  const handleSearchWithTypingControl = async () => {
    setSearchActive(true) // Hide typing effect when searching
    await handleSearch()
  }

  // Simplified file click handler - only for text files
  const handleFileClick = async (deviceId: string, filePath: string, fileName: string, hasContent: boolean) => {
    if (!hasContent) return // Do nothing for files without content

    // Determine if file is viewable based on extension
    const fileExtension = fileName.toLowerCase().split(".").pop() || ""
    const viewableExtensions = [
      "txt",
      "log",
      "json",
      "xml",
      "html",
      "htm",
      "css",
      "js",
      "csv",
      "ini",
      "cfg",
      "conf",
      "md",
      "sql",
    ]
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp"]
    const isViewable =
      viewableExtensions.includes(fileExtension) ||
      fileName.toLowerCase().includes("password") ||
      !fileName.includes(".")
    const isImage = imageExtensions.includes(fileExtension)

    if (!isViewable && !isImage) return // Do nothing for non-viewable/non-image files

    setSelectedFile({ deviceId, filePath, fileName })
    setIsLoadingFile(true)
    setSelectedFileType(isImage ? 'image' : 'text')

    try {
      const response = await fetch("/api/file-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId, filePath }),
      })

      if (response.ok) {
        if (isImage) {
          const blob = await response.blob()
          // Only use URL.createObjectURL in browser environment
          if (typeof window !== 'undefined' && window.URL) {
            setFileContent(URL.createObjectURL(blob))
          } else {
            setFileContent("Image loading not supported in this environment")
          }
        } else {
          const data = await response.json()
          setFileContent(data.content)
        }
      } else {
        setFileContent("Error loading file content")
      }
    } catch (error) {
      setFileContent("Error loading file content")
    } finally {
      setIsLoadingFile(false)
    }
  }

  // Add function for downloading all device data
  const handleDownloadAllDeviceData = async (deviceId: string, deviceName: string) => {
    try {
      const response = await fetch("/api/download-device", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId }),
      })

      if (response.ok) {
        const blob = await response.blob()
        // Only use browser APIs in browser environment
        if (typeof window !== 'undefined' && window.URL && document) {
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = `${deviceName}_complete_data.zip`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        } else {
          console.error("Download not supported in this environment")
        }
      } else {
        console.error("Failed to download device data")
      }
    } catch (error) {
      console.error("Download error:", error)
    }
  }



  const formatFileSize = (size?: number) => {
    if (!size) return ""
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    try {
      // Handle MySQL datetime format 'YYYY-MM-DD HH:mm:ss'
      let isoString = dateString
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)) {
        isoString = dateString.replace(' ', 'T') + 'Z' // treat as UTC
      }
      let date = new Date(isoString)
      if (isNaN(date.getTime())) {
        // fallback: parse manually
        const parts = dateString.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
        if (parts) {
          return `${parts[3]}/${parts[2]}/${parts[1]} ${parts[4]}:${parts[5]}:${parts[6]}`
        }
        return dateString
      }
      return date.toLocaleString()
    } catch (e) {
      return dateString
    }
  }

  // ASCII TREE BUILDER - IntelX Style with Advanced Features
  const buildASCIITree = (files: StoredFile[], matchingFiles: string[]): TreeNode[] => {
    const tree: TreeNode[] = []
    const nodeMap = new Map<string, TreeNode>()

    // Sort files by path to ensure proper hierarchy
    const sortedFiles = [...files].sort((a, b) => a.file_path.localeCompare(b.file_path))

    for (const file of sortedFiles) {
      const pathParts = file.file_path.split("/").filter((part) => part.length > 0)
      let currentPath = ""

      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i]
        const parentPath = currentPath
        currentPath = currentPath ? `${currentPath}/${part}` : part
        const isLastPart = i === pathParts.length - 1
        const isDirectory = !isLastPart || file.is_directory

        if (!nodeMap.has(currentPath)) {
          // Clean the name - remove leading numbers (IntelX style)
          let cleanName = part.replace(/^\d+[\s.-]*/, "")
          if (!cleanName || /^[\d\s.-]*$/.test(cleanName)) {
            cleanName = isDirectory ? "Folder" : "File"
          }

          const hasDirectMatch = isLastPart && matchingFiles.includes(file.file_path)

          const node: TreeNode = {
            name: cleanName,
            path: currentPath,
            isDirectory,
            hasMatch: hasDirectMatch,
            hasContent: isLastPart ? file.has_content : false,
            size: isLastPart ? file.file_size : undefined,
            children: [],
            level: i,
          }

          nodeMap.set(currentPath, node)

          // Add to parent or root
          if (parentPath && nodeMap.has(parentPath)) {
            const parent = nodeMap.get(parentPath)!
            parent.children.push(node)
          } else if (!parentPath) {
            tree.push(node)
          }
        }
      }
    }

    // Sort children within each node - Files first, then directories (IntelX style)
    const sortChildren = (node: TreeNode) => {
      node.children.sort((a, b) => {
        // Files first, directories second
        if (!a.isDirectory && b.isDirectory) return -1
        if (a.isDirectory && !b.isDirectory) return 1
        // Within same type, sort alphabetically
        return a.name.localeCompare(b.name)
      })
      node.children.forEach(sortChildren)
    }

    tree.forEach(sortChildren)

    // Sort root level - Files first, directories second
    tree.sort((a, b) => {
      if (!a.isDirectory && b.isDirectory) return -1
      if (a.isDirectory && !b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })

    return tree
  }

  // Update the file tree renderer to show visual indicators
  const renderASCIITree = (nodes: TreeNode[], isLast: boolean[] = []): React.ReactNode => {
    return nodes.map((node, index) => {
      const isLastChild = index === nodes.length - 1
      const currentIsLast = [...isLast, isLastChild]

      // Build ASCII prefix with proper tree characters
      let prefix = ""
      for (let i = 0; i < isLast.length; i++) {
        if (i === isLast.length - 1) {
          prefix += isLast[i] ? "└── " : "├── "
        } else {
          prefix += isLast[i] ? "    " : "│   "
        }
      }

      // Determine file type and action
      const fileExtension = node.name.toLowerCase().split(".").pop() || ""
      const viewableExtensions = [
        "txt",
        "log",
        "json",
        "xml",
        "html",
        "htm",
        "css",
        "js",
        "csv",
        "ini",
        "cfg",
        "conf",
        "md",
        "sql",
      ]
      const isViewable =
        viewableExtensions.includes(fileExtension) ||
        node.name.toLowerCase().includes("password") ||
        !node.name.includes(".")

      // Icon based on file type
      let icon: React.ReactNode = <Folder className="inline h-4 w-4 text-bron-accent-blue" />
      let actionIcon: React.ReactNode = ""
      let actionText = ""
      let isClickable = false

      if (!node.isDirectory) {
        if (isViewable && node.hasContent) {
          icon = <FileText className="inline h-4 w-4 text-bron-accent-green" />
          actionIcon = <Eye className="inline h-4 w-4 text-bron-accent-blue ml-1" />
          actionText = "Click to view content"
          isClickable = true
        } else if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(fileExtension) && node.hasContent) {
          icon = <ImageIcon className="inline h-4 w-4 text-bron-accent-purple" />
          actionIcon = <Eye className="inline h-4 w-4 text-bron-accent-blue ml-1" />
          actionText = "Click to preview image"
          isClickable = true
        } else if (["pdf"].includes(fileExtension)) {
          icon = <Book className="inline h-4 w-4 text-bron-accent-red" />
        } else if (["doc", "docx"].includes(fileExtension)) {
          icon = <Book className="inline h-4 w-4 text-bron-accent-blue" />
        } else if (["xls", "xlsx"].includes(fileExtension)) {
          icon = <Book className="inline h-4 w-4 text-bron-accent-green" />
        } else if (["ppt", "pptx"].includes(fileExtension)) {
          icon = <Book className="inline h-4 w-4 text-bron-accent-yellow" />
        } else if (["zip", "rar", "7z"].includes(fileExtension)) {
          icon = <Package className="inline h-4 w-4 text-bron-accent-orange" />
        } else {
          icon = <FileText className="inline h-4 w-4 text-bron-accent-gray" />
        }
      }

      const matchBadge = node.hasMatch ? " [Match]" : ""
      const sizeBadge = node.size ? ` ${formatFileSize(node.size)}` : ""

      return (
        <div key={`${node.path}-${index}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`font-mono text-sm py-1 px-2 rounded transition-colors ${
                  node.hasMatch
                    ? "bg-bron-accent-yellow/20 text-bron-accent-yellow font-medium"
                    : "text-bron-text-secondary"
                } ${isClickable ? "hover:bg-bron-accent-blue/20 cursor-pointer" : "cursor-default"}`}
                onClick={() => {
                  if (isClickable) {
                    handleFileClick(selectedDevice!.deviceId, node.path, node.name, node.hasContent || false)
                  }
                }}
              >
                <span className="text-bron-text-muted">{prefix}</span>
                <span className="mr-1">{icon}</span>
                <span className={node.hasMatch ? "font-semibold" : ""}>{node.name}</span>
                {matchBadge && <span className="text-bron-accent-yellow font-bold">{matchBadge}</span>}
                {actionIcon && <span className="text-bron-accent-blue">{actionIcon}</span>}
                {sizeBadge && <span className="text-bron-text-muted text-xs ml-1">{sizeBadge}</span>}
              </div>
            </TooltipTrigger>
            {!node.isDirectory && (
              <TooltipContent side="right" className="bg-bron-bg-tertiary border border-bron-border shadow-lg p-2">
                <div className="text-xs text-bron-text-primary">{actionText}</div>
              </TooltipContent>
            )}
          </Tooltip>

          {/* Render children recursively */}
          {node.children.length > 0 && <div>{renderASCIITree(node.children, currentIsLast)}</div>}
        </div>
      )
    })
  }

  const getMatchingFileNames = (matchingFiles: string[]) => {
    return matchingFiles.map((filePath) => {
      const fileName = filePath.split("/").pop() || filePath
      return fileName
    })
  }

  const groupResultsByName = (results: SearchResult[]) => {
    const grouped = new Map<string, SearchResult[]>()
    results.forEach((result) => {
      if (!grouped.has(result.deviceName)) {
        grouped.set(result.deviceName, [])
      }
      grouped.get(result.deviceName)!.push(result)
    })
    return grouped
  }

  const groupedResults = groupResultsByName(searchResults)

  return (
    <TooltipProvider>
      <div className="flex flex-col min-h-screen bg-bron-bg-primary">
        <main className="flex-1 p-6 bg-bron-bg-primary">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Typing effect above search card */}
            <TypingEffect
              sentences={typingSentences}
              isVisible={isStatsLoaded && typingSentences.length > 0 && !searchActive}
            />

            {/* Search Interface */}
            <SearchInterface
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchType={searchType}
              setSearchType={setSearchType}
              isLoading={isLoading}
              onSearch={handleSearchWithTypingControl}
              onDetectSearchType={detectSearchType}
            />

            {/* Error stats alert */}
            {statsError && (
              <div className="text-center py-8">
                <Alert className="bg-bron-bg-tertiary border-bron-border">
                  <Database className="h-4 w-4 text-bron-accent-blue" />
                  <AlertDescription className="text-bron-text-primary">
                    {statsError}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Search Results */}
            <SearchResults
              searchResults={searchResults}
              searchQuery={searchQuery}
              onDeviceSelect={(device) => {
                console.log("🖱️ Device card clicked:", device.deviceId, device.deviceName)
                setSelectedDevice(device)
              }}
            />

            {/* No results message */}
            {searchResults.length === 0 && searchQuery && !isLoading && stats.totalFiles > 0 && (
              <div className="text-center py-8">
                <p className="text-bron-text-muted">No devices found containing "{searchQuery}"</p>
                <p className="text-sm text-bron-text-muted mt-2">
                  Try searching with a different email or domain name.
                </p>
              </div>
            )}
          </div>
        </main>

        {/* Device Details Side Panel */}
        <DeviceDetailsPanel
          selectedDevice={selectedDevice}
          onClose={() => setSelectedDevice(null)}
          deviceCredentials={deviceCredentials}
          isLoadingCredentials={isLoadingCredentials}
          credentialsError={credentialsError}
          showPasswords={showPasswords}
          setShowPasswords={setShowPasswords}
          credentialsSearchQuery={credentialsSearchQuery}
          setCredentialsSearchQuery={setCredentialsSearchQuery}
          onRetryCredentials={() => selectedDevice && loadDeviceCredentials(selectedDevice.deviceId)}
          onFileClick={handleFileClick}
          onDownloadAllData={handleDownloadAllDeviceData}
        />

        {/* File Content Dialog */}
        <FileContentDialog
          selectedFile={selectedFile}
          onClose={() => setSelectedFile(null)}
          fileContent={fileContent}
          isLoadingFile={isLoadingFile}
          selectedFileType={selectedFileType}
          deviceName={searchResults.find((r) => r.deviceId === selectedFile?.deviceId)?.deviceName}
        />
      </div>
    </TooltipProvider>
  )
}
