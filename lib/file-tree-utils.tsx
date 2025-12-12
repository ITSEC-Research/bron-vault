import React from "react"

export interface TreeNode {
  name: string
  type: "file" | "directory"
  children?: TreeNode[]
  path?: string
  size?: number
}

export const viewableExtensions = [
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

export function isViewableFile(filename: string): boolean {
  const extension = filename.toLowerCase().split(".").pop() || ""
  return viewableExtensions.includes(extension)
}

export function renderASCIITree(
  nodes: TreeNode[], 
  isLast: boolean[] = [],
  onFileClick?: (path: string, filename: string) => void
): React.ReactNode {
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
    const isViewable = isViewableFile(node.name)

    return (
      <div key={`${node.path || node.name}-${index}`}>
        <div className="flex items-center font-mono text-sm">
          <span className="text-muted-foreground select-none">{prefix}</span>
          
          {node.type === "directory" ? (
            <span className="text-primary font-medium">
              📁 {node.name}/
            </span>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="text-foreground">
                📄 {node.name}
              </span>
              
              {node.size && (
                <span className="text-xs text-muted-foreground">
                  ({(node.size / 1024).toFixed(1)} KB)
                </span>
              )}
              
              {isViewable && onFileClick && (
                <button
                  onClick={() => onFileClick(node.path || node.name, node.name)}
                  className="text-xs bg-emerald-500 text-white px-2 py-1 rounded hover:bg-emerald-600 transition-colors"
                  title="Click to view file content"
                >
                  View
                </button>
              )}
            </div>
          )}
        </div>
        
        {node.children && node.children.length > 0 && (
          <div className="ml-0">
            {renderASCIITree(node.children, currentIsLast, onFileClick)}
          </div>
        )}
      </div>
    )
  })
}

export function buildFileTree(files: { [key: string]: string }): TreeNode[] {
  const root: TreeNode[] = []
  const pathMap = new Map<string, TreeNode>()

  // Sort paths to ensure consistent ordering
  const sortedPaths = Object.keys(files).sort()

  for (const filePath of sortedPaths) {
    const parts = filePath.split("/").filter(part => part.length > 0)
    let currentLevel = root
    let currentPath = ""

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      currentPath += (currentPath ? "/" : "") + part
      
      let existingNode = currentLevel.find(node => node.name === part)
      
      if (!existingNode) {
        const isFile = i === parts.length - 1
        const newNode: TreeNode = {
          name: part,
          type: isFile ? "file" : "directory",
          path: currentPath,
          children: isFile ? undefined : [],
          size: isFile ? files[filePath]?.length : undefined
        }
        
        currentLevel.push(newNode)
        pathMap.set(currentPath, newNode)
        existingNode = newNode
      }
      
      if (existingNode.children) {
        currentLevel = existingNode.children
      }
    }
  }

  return root
}
