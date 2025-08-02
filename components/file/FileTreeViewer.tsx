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
          icon = <Image className="inline h-4 w-4 text-bron-accent-purple" />
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
          <TooltipProvider>
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
                      onFileClick(selectedDevice.deviceId, node.path, node.name, node.hasContent)
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
          </TooltipProvider>

          {/* Render children recursively */}
          {node.children.length > 0 && <div>{renderASCIITree(node.children, currentIsLast)}</div>}
        </div>
      )
    })
  }

  return (
    <div className="bg-bron-bg-tertiary p-4 rounded-lg border border-bron-border">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-bron-text-muted">
          Stolen File Structure ({selectedDevice.totalFiles} files total)
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDownloadAllData(selectedDevice.deviceId, selectedDevice.deviceName)}
          className="flex items-center space-x-2 bg-bron-bg-secondary border-bron-border text-bron-text-primary hover:bg-bron-bg-primary"
        >
          <Download className="h-4 w-4" />
          <span>Download All Data</span>
        </Button>
      </div>
      <div className="bg-bron-bg-secondary p-3 rounded border border-bron-border overflow-x-auto">
        <div className="min-w-max">
          {renderASCIITree(buildASCIITree(selectedDevice.files, selectedDevice.matchingFiles))}
        </div>
      </div>
      <div className="mt-3 text-xs text-bron-text-muted">
        <div className="flex items-center space-x-4">
          <span className="flex items-center"><Eye className="inline h-4 w-4 text-bron-accent-blue mr-1" /> = Viewable text file</span>
          <span className="flex items-center"><Image className="inline h-4 w-4 text-bron-accent-purple mr-1" /> = Image</span>
          <span className="flex items-center"><Book className="inline h-4 w-4 text-bron-accent-red mr-1" /> = PDF</span>
          <span className="flex items-center"><Book className="inline h-4 w-4 text-bron-accent-blue mr-1" /> = Document</span>
          <span className="flex items-center"><Book className="inline h-4 w-4 text-bron-accent-green mr-1" /> = Spreadsheet</span>
          <span className="flex items-center"><Book className="inline h-4 w-4 text-bron-accent-yellow mr-1" /> = Presentation</span>
        </div>
        <div className="mt-1 text-xs text-bron-accent-yellow">
          Note: Binary files are available via "Download All Data" button above
        </div>
      </div>
    </div>
  )
}
