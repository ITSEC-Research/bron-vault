"use client"

import React from "react"
import { Download, Eye, Image, Book, Package, Folder, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface StoredFile {
  file_path: string
  file_name: string
  parent_path: string
  is_directory: boolean
  file_size?: number
  has_content: boolean
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

// ASCII Tree Node Interface - IntelX Style
interface TreeNode {
  name: string
  path: string
  isDirectory: boolean
  hasMatch: boolean
  hasContent: boolean
  size?: number
  children: TreeNode[]
  level: number
}

interface FileTreeViewerProps {
  selectedDevice: SearchResult
  onFileClick: (deviceId: string, filePath: string, fileName: string, hasContent: boolean) => void
  onDownloadAllData: (deviceId: string, deviceName: string) => void
}

export function FileTreeViewer({ selectedDevice, onFileClick, onDownloadAllData }: FileTreeViewerProps) {
  const formatFileSize = (size?: number) => {
    if (!size) return ""
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
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
      let icon: React.ReactNode = <Folder className="inline h-4 w-4 text-blue-500" />
      let actionIcon: React.ReactNode = ""
      let actionText = ""
      let isClickable = false

      if (!node.isDirectory) {
        if (isViewable && node.hasContent) {
          icon = <FileText className="inline h-4 w-4 text-emerald-500" />
          actionIcon = <Eye className="inline h-4 w-4 text-blue-500 ml-1" />
          actionText = "Click to view content"
          isClickable = true
        } else if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(fileExtension) && node.hasContent) {
          icon = <Image className="inline h-4 w-4 text-violet-500" />
          actionIcon = <Eye className="inline h-4 w-4 text-blue-500 ml-1" />
          actionText = "Click to preview image"
          isClickable = true
        } else if (["pdf"].includes(fileExtension)) {
          icon = <Book className="inline h-4 w-4 text-primary" />
        } else if (["doc", "docx"].includes(fileExtension)) {
          icon = <Book className="inline h-4 w-4 text-blue-500" />
        } else if (["xls", "xlsx"].includes(fileExtension)) {
          icon = <Book className="inline h-4 w-4 text-emerald-500" />
        } else if (["ppt", "pptx"].includes(fileExtension)) {
          icon = <Book className="inline h-4 w-4 text-amber-500" />
        } else if (["zip", "rar", "7z"].includes(fileExtension)) {
          icon = <Package className="inline h-4 w-4 text-orange-500" />
        } else {
          icon = <FileText className="inline h-4 w-4 text-muted-foreground" />
        }
      }

      const matchBadge = node.hasMatch ? " [Match]" : ""
      const sizeBadge = node.size ? ` ${formatFileSize(node.size)}` : ""

      return (
        <div key={`${node.path}-${index}`}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`font-mono text-xs py-1 px-2 rounded transition-colors ${
                    node.hasMatch
                      ? "bg-amber-500/20 text-amber-500 font-medium"
                      : "text-foreground"
                  } ${isClickable ? "hover:bg-white/5 cursor-pointer" : "cursor-default"}`}
                  onClick={() => {
                    if (isClickable) {
                      onFileClick(selectedDevice.deviceId, node.path, node.name, node.hasContent)
                    }
                  }}
                >
                  <span className="text-muted-foreground">{prefix}</span>
                  <span className="mr-1">{icon}</span>
                  <span className={node.hasMatch ? "font-semibold" : ""}>{node.name}</span>
                  {matchBadge && <span className="text-amber-500 font-bold">{matchBadge}</span>}
                  {actionIcon && <span className="text-blue-500">{actionIcon}</span>}
                  {sizeBadge && <span className="text-muted-foreground text-xs ml-1">{sizeBadge}</span>}
                </div>
              </TooltipTrigger>
              {!node.isDirectory && (
                <TooltipContent side="right" className="glass-card shadow-lg p-2">
                  <div className="text-xs text-foreground">{actionText}</div>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {/* Render children recursively */}
          {node.children.length > 0 && <div>{renderASCIITree(node.children, currentIsLast)}</div>}
        </div>
      )
    })
  }

  return (
    <div className="glass-card p-4 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          Stolen File Structure ({selectedDevice.totalFiles} files total)
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDownloadAllData(selectedDevice.deviceId, selectedDevice.deviceName)}
          className="flex items-center space-x-2 glass-card hover:border-primary/30 text-foreground"
        >
          <Download className="h-4 w-4" />
          <span>Download All Data</span>
        </Button>
      </div>
      <div className="glass p-3 rounded border border-white/5 overflow-x-auto">
        <div className="min-w-max">
          {renderASCIITree(buildASCIITree(selectedDevice.files, selectedDevice.matchingFiles))}
        </div>
      </div>
      <div className="mt-3 mb-2 text-xs text-muted-foreground">
        <div className="flex items-center space-x-4">
          <span className="flex items-center"><Eye className="inline h-4 w-4 text-blue-500 mr-1" /> = Viewable text file</span>
          <span className="flex items-center"><Image className="inline h-4 w-4 text-violet-500 mr-1" /> = Image</span>
          <span className="flex items-center"><Book className="inline h-4 w-4 text-primary mr-1" /> = PDF</span>
          <span className="flex items-center"><Book className="inline h-4 w-4 text-blue-500 mr-1" /> = Document</span>
          <span className="flex items-center"><Book className="inline h-4 w-4 text-emerald-500 mr-1" /> = Spreadsheet</span>
          <span className="flex items-center"><Book className="inline h-4 w-4 text-amber-500 mr-1" /> = Presentation</span>
        </div>
        <div className="mt-1 text-xs text-amber-500">
          Note: Binary files are available via "Download All Data" button above
        </div>
      </div>
    </div>
  )
}
