import { type NextRequest, NextResponse } from "next/server"
import JSZip from "jszip"
import { validateRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    console.log(`🔍 DEBUG: Analyzing large ZIP file: ${file.name} (${file.size} bytes)`)

    const bytes = await file.arrayBuffer()
    const zip = new JSZip()
    const zipData = await zip.loadAsync(bytes)

    console.log(`📦 ZIP loaded successfully, total entries: ${Object.keys(zipData.files).length}`)

    // ENHANCED SMART DEVICE DETECTION with macOS support
    const structureAnalysis = analyzeZipStructureWithMacOSSupport(zipData)
    console.log(`🧠 ZIP Structure Analysis:`, structureAnalysis)

    // Use smart device detection
    const deviceMap = new Map<string, any[]>()
    const deviceAnalysis = new Map<
      string,
      {
        totalFiles: number
        passwordFiles: number
        directories: number
        samplePaths: string[]
      }
    >()

    let totalEntries = 0
    let totalDirectories = 0
    let totalFiles = 0

    // Group files by device using smart detection
    for (const [relativePath, zipEntry] of Object.entries(zipData.files)) {
      totalEntries++

      if (zipEntry.dir) {
        totalDirectories++
      } else {
        totalFiles++
      }

      const pathParts = relativePath.split("/").filter((part) => part.length > 0)
      if (pathParts.length === 0) continue

      // SMART DEVICE NAME EXTRACTION with macOS filtering
      const deviceName = extractDeviceNameWithMacOSSupport(pathParts, structureAnalysis)
      if (!deviceName) continue

      if (!deviceMap.has(deviceName)) {
        deviceMap.set(deviceName, [])
        deviceAnalysis.set(deviceName, {
          totalFiles: 0,
          passwordFiles: 0,
          directories: 0,
          samplePaths: [],
        })
      }

      deviceMap.get(deviceName)?.push({
        path: relativePath,
        entry: zipEntry,
        isDir: zipEntry.dir,
      })

      const analysis = deviceAnalysis.get(deviceName)!
      if (zipEntry.dir) {
        analysis.directories++
      } else {
        analysis.totalFiles++

        // Check for password files
        const fileName = relativePath.toLowerCase()
        if (fileName.includes("password") && !zipEntry.dir) {
          analysis.passwordFiles++
        }
      }

      // Store sample paths (first 5)
      if (analysis.samplePaths.length < 5) {
        analysis.samplePaths.push(relativePath)
      }
    }

    console.log(`📊 Device analysis complete:`)
    console.log(`   - Total entries: ${totalEntries}`)
    console.log(`   - Total directories: ${totalDirectories}`)
    console.log(`   - Total files: ${totalFiles}`)
    console.log(`   - Unique devices detected: ${deviceMap.size}`)

    // Detailed device analysis
    const deviceDetails = Array.from(deviceAnalysis.entries()).map(([deviceName, analysis]) => ({
      deviceName,
      ...analysis,
    }))

    // Sort by total files descending
    deviceDetails.sort((a, b) => b.totalFiles - a.totalFiles)

    console.log(`🔍 Top 10 devices by file count:`)
    deviceDetails.slice(0, 10).forEach((device, index) => {
      console.log(
        `   ${index + 1}. ${device.deviceName}: ${device.totalFiles} files, ${device.passwordFiles} password files`,
      )
    })

    // Check for potential issues
    const issues = []

    // Check for devices with no files
    const emptyDevices = deviceDetails.filter((d) => d.totalFiles === 0)
    if (emptyDevices.length > 0) {
      issues.push(`Found ${emptyDevices.length} devices with no files`)
    }

    // Check for devices with no password files
    const noPasswordDevices = deviceDetails.filter((d) => d.passwordFiles === 0)
    if (noPasswordDevices.length > 0) {
      issues.push(`Found ${noPasswordDevices.length} devices with no password files`)
    }

    // Check for very long device names (potential parsing issues)
    const longNameDevices = deviceDetails.filter((d) => d.deviceName.length > 100)
    if (longNameDevices.length > 0) {
      issues.push(`Found ${longNameDevices.length} devices with very long names (>100 chars)`)
    }

    // Check for device names with special characters
    const specialCharDevices = deviceDetails.filter((d) => /[<>:"|?*]/.test(d.deviceName))
    if (specialCharDevices.length > 0) {
      issues.push(`Found ${specialCharDevices.length} devices with special characters in names`)
    }

    return NextResponse.json({
      success: true,
      analysis: {
        fileName: file.name,
        fileSize: file.size,
        totalEntries,
        totalDirectories,
        totalFiles,
        uniqueDevices: deviceMap.size,
        deviceDetails: deviceDetails.slice(0, 20), // Top 20 devices
        issues,
        sampleDeviceNames: deviceDetails.slice(0, 10).map((d) => d.deviceName),
        structureInfo: structureAnalysis,
      },
    })
  } catch (error) {
    console.error("❌ Debug large ZIP error:", error)
    return NextResponse.json(
      {
        error: "Failed to analyze large ZIP",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// ENHANCED SMART ZIP STRUCTURE ANALYSIS with macOS Support
function analyzeZipStructureWithMacOSSupport(zipData: JSZip): {
  hasPreDirectory: boolean
  preDirectoryName: string | null
  deviceLevel: number
  structureType: "direct" | "pre-directory" | "nested"
  samplePaths: string[]
  macOSDetected: boolean
  filteredDirectories: string[]
} {
  const allPaths = Object.keys(zipData.files).filter((path) => !zipData.files[path].dir)
  const samplePaths = allPaths.slice(0, 10)

  console.log(`🔍 Analyzing structure from ${allPaths.length} files`)
  console.log(`📝 Sample paths:`, samplePaths)

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

  // FILTER OUT SYSTEM DIRECTORIES (macOS, Windows, etc.)
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

  // Filter out system directories and hidden directories
  const filteredDirs = Array.from(firstLevelDirs).filter((dir) => {
    // Skip system directories
    if (systemDirectories.has(dir)) {
      console.log(`🚫 Filtering out system directory: ${dir}`)
      return false
    }

    // Skip hidden directories (starting with .)
    if (dir.startsWith(".")) {
      console.log(`🚫 Filtering out hidden directory: ${dir}`)
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
      deviceLevel: 1, // Devices are at level 1 (after pre-directory)
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
      deviceLevel: 0, // Devices are at level 0
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

// ENHANCED SMART DEVICE NAME EXTRACTION with macOS Support
function extractDeviceNameWithMacOSSupport(
  pathParts: string[],
  structureInfo: {
    hasPreDirectory: boolean
    preDirectoryName: string | null
    deviceLevel: number
    structureType: string
    macOSDetected: boolean
  },
): string | null {
  if (pathParts.length === 0) return null

  // SKIP macOS SYSTEM FILES
  if (pathParts[0] === "__MACOSX" || pathParts[0].startsWith(".")) {
    return null // Skip macOS metadata files
  }

  if (structureInfo.hasPreDirectory && structureInfo.preDirectoryName) {
    // Pre-directory structure: skip the first directory
    if (pathParts.length <= 1) return null // No device level
    if (pathParts[0] !== structureInfo.preDirectoryName) return null // Wrong pre-directory

    // Device name is at level 1
    return pathParts[1]
  } else {
    // Direct structure: device name is at level 0
    return pathParts[0]
  }
}
