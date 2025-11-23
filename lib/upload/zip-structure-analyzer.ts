import JSZip from "jszip"

export interface ZipStructureInfo {
  hasPreDirectory: boolean
  preDirectoryName: string | null
  deviceLevel: number
  structureType: "direct" | "pre-directory" | "nested"
  samplePaths: string[]
  macOSDetected: boolean
  filteredDirectories: string[]
}

export function analyzeZipStructureWithMacOSSupport(zipData: JSZip): ZipStructureInfo {
  const allPaths = Object.keys(zipData.files).filter((path) => !zipData.files[path].dir)
  const samplePaths = allPaths.slice(0, 10)

  console.log(`🔍 Analyzing structure from ${allPaths.length} files`)

  // Count depth levels
  const depthCounts = new Map<number, number>()
  const firstLevelDirs = new Set<string>()

  for (const path of allPaths) {
    const parts = path.split("/").filter((p) => p.length > 0)
    const depth = parts.length

    depthCounts.set(depth, (depthCounts.get(depth) || 0) + 1)

    if (parts.length > 0) {
      firstLevelDirs.add(parts[0])
    }
  }

  console.log(`📊 Depth analysis:`, Object.fromEntries(depthCounts))
  console.log(`📁 First level directories (${firstLevelDirs.size}):`, Array.from(firstLevelDirs).slice(0, 10))

  // FILTER OUT SYSTEM DIRECTORIES AND FILES
  const systemDirectories = new Set([
    "__MACOSX", // macOS metadata
    ".DS_Store", // macOS metadata
    "Thumbs.db", // Windows metadata
    ".Trashes", // macOS trash
    ".fseventsd", // macOS file system events
    ".Spotlight-V100", // macOS Spotlight
    ".TemporaryItems", // macOS temp
    "System Volume Information", // Windows system
  ])

  // Filter out system directories, files, and hidden items
  const filteredDirs = Array.from(firstLevelDirs).filter((dir) => {
    // Skip system directories and files
    if (systemDirectories.has(dir)) {
      console.log(`🚫 Filtering out system item: ${dir}`)
      return false
    }

    // Skip hidden directories and files (starting with .)
    if (dir.startsWith(".")) {
      console.log(`🚫 Filtering out hidden item: ${dir}`)
      return false
    }

    // Skip if it's a file (not a directory)
    const isFile = Object.keys(zipData.files).some(path => {
      const parts = path.split("/").filter(p => p.length > 0)
      return parts.length === 1 && parts[0] === dir && !zipData.files[path].dir
    })

    if (isFile) {
      console.log(`🚫 Filtering out file: ${dir}`)
      return false
    }

    return true
  })

  const macOSDetected = firstLevelDirs.has("__MACOSX")
  if (macOSDetected) {
    console.log(`🍎 macOS ZIP detected! Filtering out __MACOSX directory`)
  }

  console.log(`📁 Filtered directories (${filteredDirs.length}):`, filteredDirs)

  // Determine structure type based on FILTERED directories
  if (filteredDirs.length === 1) {
    // Only one real directory after filtering - PRE-DIRECTORY structure
    const preDir = filteredDirs[0]
    console.log(`🎯 Detected PRE-DIRECTORY structure with: "${preDir}" (macOS: ${macOSDetected})`)

    return {
      hasPreDirectory: true,
      preDirectoryName: preDir,
      deviceLevel: 1,
      structureType: "pre-directory",
      samplePaths,
      macOSDetected,
      filteredDirectories: filteredDirs,
    }
  } else if (filteredDirs.length > 10) {
    // Many directories after filtering - DIRECT DEVICE structure
    console.log(`🎯 Detected DIRECT DEVICE structure with ${filteredDirs.length} devices (macOS: ${macOSDetected})`)

    return {
      hasPreDirectory: false,
      preDirectoryName: null,
      deviceLevel: 0,
      structureType: "direct",
      samplePaths,
      macOSDetected,
      filteredDirectories: filteredDirs,
    }
  } else {
    // Mixed or nested structure
    console.log(`🎯 Detected NESTED/MIXED structure with ${filteredDirs.length} directories (macOS: ${macOSDetected})`)

    return {
      hasPreDirectory: false,
      preDirectoryName: null,
      deviceLevel: 0,
      structureType: "nested",
      samplePaths,
      macOSDetected,
      filteredDirectories: filteredDirs,
    }
  }
}

export function extractDeviceNameWithMacOSSupport(
  pathParts: string[],
  structureInfo: ZipStructureInfo,
): string | null {
  if (pathParts.length === 0) return null

  // SKIP macOS SYSTEM FILES AND HIDDEN FILES
  if (pathParts[0] === "__MACOSX" || pathParts[0].startsWith(".")) {
    return null // Skip macOS metadata files and hidden files
  }

  // Additional filtering for system files
  const systemFiles = new Set([
    ".DS_Store",
    "Thumbs.db",
    ".Trashes",
    ".fseventsd",
    ".Spotlight-V100",
    ".TemporaryItems",
    "System Volume Information"
  ])

  if (systemFiles.has(pathParts[0])) {
    return null // Skip system files
  }

  if (structureInfo.hasPreDirectory && structureInfo.preDirectoryName) {
    // Pre-directory structure: device name is at level 1 (sub-directory)
    if (pathParts.length <= 1) return null // No device level
    if (pathParts[0] !== structureInfo.preDirectoryName) return null // Wrong pre-directory

    // Additional check for system files at level 1
    if (systemFiles.has(pathParts[1])) {
      return null // Skip system files at device level
    }

    // Device name is at level 1 (sub-directory), not level 0 (pre-directory)
    return pathParts[1]
  } else {
    // Direct structure: device name is at level 0
    return pathParts[0]
  }
}

export function isLikelyTextFile(fileName: string): boolean {
  const textExtensions = [
    ".txt",
    ".log",
    ".json",
    ".xml",
    ".html",
    ".htm",
    ".css",
    ".js",
    ".csv",
    ".ini",
    ".cfg",
    ".conf",
    ".md",
    ".readme",
    ".sql",
  ]

  const lowerFileName = fileName.toLowerCase()

  if (textExtensions.some((ext) => lowerFileName.endsWith(ext))) {
    return true
  }

  if (lowerFileName.includes("password") || lowerFileName.includes("login") || lowerFileName.includes("credential")) {
    return true
  }

  if (!lowerFileName.includes(".")) {
    return true
  }

  return false
}

