import { mkdir } from "fs/promises"
import { existsSync, createReadStream, createWriteStream } from "fs"
import path from "path"
import { executeQuery } from "@/lib/mysql"
import crypto from "crypto"
import yauzl from "yauzl"
import { promisify } from "util"
import { pipeline } from "stream/promises"
import {
  extractDeviceNameWithMacOSSupport,
  type ZipStructureInfo,
} from "./zip-structure-analyzer"
import { processDevice, type DeviceProcessingResult } from "./device-processor"

export interface ProcessingResult {
  devicesFound: number
  devicesProcessed: number
  devicesSkipped: number
  totalFiles: number
  totalCredentials: number
  totalDomains: number
  totalUrls: number
  totalBinaryFiles: number
  uploadBatch: string
  processedDevices: string[]
  skippedDevices: string[]
  structureInfo: ZipStructureInfo
}

// Helper: Analyze ZIP structure from paths array (not JSZip)
function analyzeZipStructureFromPaths(allPaths: string[]): ZipStructureInfo {
  const samplePaths = allPaths.slice(0, 10)

  console.log(`🔍 Analyzing structure from ${allPaths.length} files`)

  // Count depth levels
  const depthCounts = new Map<number, number>()
  const firstLevelDirs = new Set<string>()

  for (const filePath of allPaths) {
    const parts = filePath.split("/").filter((p) => p.length > 0)
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
    "__MACOSX",
    ".DS_Store",
    "Thumbs.db",
    ".Trashes",
    ".fseventsd",
    ".Spotlight-V100",
    ".TemporaryItems",
    "System Volume Information",
  ])

  // Filter out system directories, files, and hidden items
  const filteredDirs = Array.from(firstLevelDirs).filter((dir) => {
    if (systemDirectories.has(dir)) {
      console.log(`🚫 Filtering out system item: ${dir}`)
      return false
    }

    if (dir.startsWith(".")) {
      console.log(`🚫 Filtering out hidden item: ${dir}`)
      return false
    }

    // Check if it's a file (not a directory) by checking if any path has this as the only part
    const isFile = allPaths.some((p) => {
      const parts = p.split("/").filter((part) => part.length > 0)
      return parts.length === 1 && parts[0] === dir
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

  // Determine structure type
  if (filteredDirs.length === 1) {
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

// Helper: Convert yauzl entry to buffer/text
async function readEntryContent(
  zipfile: yauzl.ZipFile,
  entry: yauzl.Entry,
): Promise<{ text: string | null; buffer: Buffer | null }> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, readStream) => {
      if (err) {
        reject(err)
        return
      }

      const chunks: Buffer[] = []
      readStream.on("data", (chunk: Buffer) => {
        chunks.push(chunk)
      })
      readStream.on("end", () => {
        const buffer = Buffer.concat(chunks)
        // Try to decode as text, return null if not text
        try {
          const text = buffer.toString("utf8")
          resolve({ text, buffer })
        } catch {
          resolve({ text: null, buffer })
        }
      })
      readStream.on("error", (error) => {
        reject(error)
      })
    })
  })
}

// Wrapper untuk yauzl entry agar kompatibel dengan device-processor
class YauzlEntryWrapper {
  constructor(
    public path: string,
    public entry: yauzl.Entry,
    public zipfile: yauzl.ZipFile,
    private contentCache: { text?: string; buffer?: Buffer } | null = null,
  ) {}

  get dir(): boolean {
    return /\/$/.test(this.entry.fileName)
  }

  async async(format: "text" | "uint8array"): Promise<string | Uint8Array> {
    if (!this.contentCache) {
      const { text, buffer } = await readEntryContent(this.zipfile, this.entry)
      this.contentCache = { text: text || undefined, buffer: buffer || undefined }
    }

    if (format === "text") {
      if (this.contentCache.text !== undefined) {
        return this.contentCache.text
      }
      throw new Error(`Entry ${this.path} is not a text file`)
    } else {
      if (this.contentCache.buffer) {
        return new Uint8Array(this.contentCache.buffer)
      }
      throw new Error(`Entry ${this.path} has no buffer`)
    }
  }
}

// Promisify yauzl.open with proper typing
const yauzlOpen = (path: string, options?: yauzl.Options) => {
  return new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.open(path, options || {}, (err, zipfile) => {
      if (err) reject(err)
      else resolve(zipfile)
    })
  })
}

/**
 * Process ZIP file using yauzl (streaming) - for large files
 * This reads entries one by one without loading entire file to memory
 */
export async function processZipStream(
  filePath: string,
  uploadBatch: string,
  logWithBroadcast: (message: string, type?: "info" | "success" | "warning" | "error") => void,
): Promise<ProcessingResult> {
  let zipfile2: yauzl.ZipFile | null = null
  try {
    const { stat } = await import("fs/promises")
    const stats = await stat(filePath)
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2)
    logWithBroadcast(
      `🚀 Processing ZIP file with STREAMING (yauzl), size: ${stats.size} bytes (${fileSizeMB} MB)`,
      "info",
    )

    // Create extraction directory
    const today = new Date().toISOString().split("T")[0]
    const extractionBaseDir = path.join(process.cwd(), "uploads", "extracted_files", today, uploadBatch)
    logWithBroadcast(`📁 Creating extraction directory: ${extractionBaseDir}`, "info")
    if (!existsSync(extractionBaseDir)) {
      await mkdir(extractionBaseDir, { recursive: true })
    }

    // PASS 1: Read all entry metadata to analyze structure
    logWithBroadcast("📦 PASS 1: Reading ZIP metadata for structure analysis...", "info")
    const zipfile = await yauzlOpen(filePath, { lazyEntries: true })

    const allPaths: string[] = []
    const entryMap = new Map<string, yauzl.Entry>()

    await new Promise<void>((resolve, reject) => {
      zipfile.readEntry()
      zipfile.on("entry", (entry: yauzl.Entry) => {
        // Normalize path (remove leading slash, handle Windows paths)
        const normalizedPath = entry.fileName.replace(/\\/g, "/").replace(/^\/+/, "")
        
        if (!entry.fileName.endsWith("/")) {
          // Only add files, not directories
          allPaths.push(normalizedPath)
          entryMap.set(normalizedPath, entry)
        }
        
        zipfile.readEntry()
      })
      zipfile.on("end", () => {
        logWithBroadcast(`✅ PASS 1 complete: Found ${allPaths.length} files`, "success")
        // DON'T close zipfile here - we need it for PASS 2
        resolve()
      })
      zipfile.on("error", reject)
    })

    // Analyze structure
    const structureInfo = analyzeZipStructureFromPaths(allPaths)
    logWithBroadcast(`🧠 ZIP Structure Analysis: ${JSON.stringify(structureInfo)}`, "info")

    // Group files by device
    logWithBroadcast(`🔍 Grouping files by device using ${structureInfo.structureType} structure...`, "info")
    const deviceMap = new Map<string, Array<{ path: string; entry: yauzl.Entry }>>()
    let entryCount = 0

    for (const filePath of allPaths) {
      entryCount++
      if (entryCount % 1000 === 0) {
        logWithBroadcast(`📊 Processed ${entryCount} entries so far...`, "info")
      }

      const pathParts = filePath.split("/").filter((part) => part.length > 0)
      if (pathParts.length === 0) {
        continue
      }

      const deviceName = extractDeviceNameWithMacOSSupport(pathParts, structureInfo)
      if (!deviceName) {
        if (pathParts[0] === ".DS_Store" || pathParts[0].startsWith(".")) {
          // Skip system files silently
        }
        continue
      }

      if (!deviceMap.has(deviceName)) {
        deviceMap.set(deviceName, [])
        logWithBroadcast(`📱 New device detected: "${deviceName}" (device #${deviceMap.size})`, "info")
      }

      const entry = entryMap.get(filePath)
      if (entry) {
        deviceMap.get(deviceName)!.push({ path: filePath, entry })
      }
    }

    const devicesFound = deviceMap.size
    logWithBroadcast(`✅ Device grouping complete:`, "success")
    logWithBroadcast(`   - Total entries processed: ${entryCount}`, "info")
    logWithBroadcast(`   - Total devices found: ${devicesFound}`, "info")
    logWithBroadcast(`   - Structure type: ${structureInfo.structureType}`, "info")
    logWithBroadcast(`   - macOS ZIP: ${structureInfo.macOSDetected}`, "info")

    // Check for existing devices
    const deviceNames = Array.from(deviceMap.keys())
    logWithBroadcast(`🔍 Checking for existing devices among ${deviceNames.length} devices...`, "info")

    const deviceHashes = deviceNames.map((name) => ({
      name,
      hash: crypto.createHash("sha256").update(name.toLowerCase()).digest("hex"),
    }))

    let existingDeviceHashes = new Set()
    if (deviceHashes.length > 0) {
      const existingDevicesQuery = `
        SELECT device_name_hash, device_name 
        FROM devices 
        WHERE device_name_hash IN (${deviceHashes.map(() => "?").join(",")})
      `
      const existingDevices = (await executeQuery(
        existingDevicesQuery,
        deviceHashes.map((d) => d.hash),
      )) as any[]

      existingDeviceHashes = new Set(existingDevices.map((d) => d.device_name_hash))
    }

    // PASS 2: Process each device
    logWithBroadcast(`🔄 PASS 2: Processing ${deviceMap.size} devices...`, "info")
    
    // Reopen ZIP file for reading content (zipfile from PASS 1 is closed after "end" event)
    // We need a new zipfile instance to read entry contents
    // IMPORTANT: Set autoClose: false to prevent automatic file close after "end" event
    // We need to keep the file open to read entry contents later
    zipfile2 = await yauzlOpen(filePath, { lazyEntries: true, autoClose: false })
    const entryMap2 = new Map<string, yauzl.Entry>()

    // Build entry map for PASS 2 (we need fresh entries from the new zipfile)
    if (!zipfile2) {
      throw new Error("Failed to open ZIP file for PASS 2")
    }
    
    await new Promise<void>((resolve, reject) => {
      zipfile2!.readEntry()
      zipfile2!.on("entry", (entry: yauzl.Entry) => {
        const normalizedPath = entry.fileName.replace(/\\/g, "/").replace(/^\/+/, "")
        if (!entry.fileName.endsWith("/")) {
          entryMap2.set(normalizedPath, entry)
        }
        zipfile2!.readEntry()
      })
      zipfile2!.on("end", () => {
        logWithBroadcast(`✅ PASS 2 entry map ready: ${entryMap2.size} entries`, "success")
        resolve()
      })
      zipfile2!.on("error", reject)
    })
    
    // Now update deviceMap to use entries from zipfile2
    for (const [deviceName, deviceFiles] of deviceMap) {
      for (let i = 0; i < deviceFiles.length; i++) {
        const filePath = deviceFiles[i].path
        const newEntry = entryMap2.get(filePath)
        if (newEntry) {
          deviceFiles[i].entry = newEntry
        }
      }
    }

    let devicesSkipped = 0
    let devicesProcessed = 0
    let totalFiles = 0
    let totalCredentials = 0
    let totalDomains = 0
    let totalUrls = 0
    let totalBinaryFiles = 0
    const processedDevices: string[] = []
    const skippedDevices: string[] = []
    let deviceIndex = 0

    for (const [deviceName, deviceFiles] of deviceMap) {
      deviceIndex++
      logWithBroadcast(`\n🖥️ Processing device ${deviceIndex}/${deviceMap.size}: "${deviceName}"`, "info")
      logWithBroadcast(`[PROGRESS] ${deviceIndex}/${deviceMap.size}`, "info")

      const deviceHash = crypto.createHash("sha256").update(deviceName.toLowerCase()).digest("hex")

      if (existingDeviceHashes.has(deviceHash)) {
        logWithBroadcast(`⏭️ SKIPPING duplicate device: "${deviceName}"`, "warning")
        devicesSkipped++
        skippedDevices.push(deviceName)
        continue
      }

      logWithBroadcast(`✅ Device "${deviceName}" is NEW, proceeding with processing...`, "success")
      logWithBroadcast(`📁 Device has ${deviceFiles.length} files/folders`, "info")

      const deviceId = `device_${uploadBatch}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Convert yauzl entries to wrapper format for device-processor
      // Use zipfile2 from PASS 2 - entries are still valid and zipfile is still open
      if (!zipfile2) {
        throw new Error("ZIP file is not open for reading entry contents")
      }
      
      const zipFiles = deviceFiles.map(({ path: filePath, entry }) => {
        return {
          path: filePath,
          entry: new YauzlEntryWrapper(filePath, entry, zipfile2!),
        }
      })

      // Process device
      const deviceResult: DeviceProcessingResult = await processDevice(
        deviceName,
        zipFiles,
        deviceHash,
        deviceId,
        uploadBatch,
        extractionBaseDir,
        logWithBroadcast,
      )

      for (const zipFile of zipFiles) {
        if (!zipFile.entry.dir) {
          totalFiles++
        }
      }

      devicesProcessed++
      processedDevices.push(deviceName)
      totalCredentials += deviceResult.deviceCredentials
      totalDomains += deviceResult.deviceDomains
      totalUrls += deviceResult.deviceUrls
      totalBinaryFiles += deviceResult.deviceBinaryFiles
    }

    logWithBroadcast(`🎯 Processing summary:`, "info")
    logWithBroadcast(`   - Structure type: ${structureInfo.structureType}`, "info")
    logWithBroadcast(`   - macOS ZIP: ${structureInfo.macOSDetected}`, "info")
    logWithBroadcast(`   - Devices found: ${devicesFound}`, "info")
    logWithBroadcast(`   - Devices processed: ${devicesProcessed}`, "info")
    logWithBroadcast(`   - Devices skipped: ${devicesSkipped}`, "info")
    logWithBroadcast(`   - Total credentials: ${totalCredentials}`, "info")
    logWithBroadcast(`   - Total domains: ${totalDomains}`, "info")
    logWithBroadcast(`   - Total URLs: ${totalUrls}`, "info")
    logWithBroadcast(`   - Total files: ${totalFiles}`, "info")
    logWithBroadcast(`   - Total binary files saved: ${totalBinaryFiles}`, "info")

    // Clear all analytics cache to ensure fresh data after upload
    // This ensures users see new data immediately, not cached old data
    await executeQuery("DELETE FROM analytics_cache WHERE cache_key IN ('stats_main', 'browser_analysis', 'software_analysis', 'top_tlds')")

    // Close zipfile2 to free resources
    try {
      if (zipfile2) {
        zipfile2.close()
      }
    } catch (closeError) {
      // Ignore close errors
    }

    return {
      devicesFound,
      devicesProcessed,
      devicesSkipped,
      totalFiles,
      totalCredentials,
      totalDomains,
      totalUrls,
      totalBinaryFiles,
      uploadBatch,
      processedDevices,
      skippedDevices,
      structureInfo,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    logWithBroadcast(`💥 Processing error: ${errorMessage}`, "error")
    if (errorStack) {
      logWithBroadcast(`📋 Error stack: ${errorStack}`, "error")
    }

    // Cleanup zipfile2 if it exists
    try {
      // zipfile2 might not be defined if error occurred before PASS 2
      if (typeof zipfile2 !== 'undefined' && zipfile2) {
        zipfile2.close()
      }
    } catch (closeError) {
      // Ignore close errors
    }

    throw new Error(`Failed to process zip file: ${errorMessage}`)
  }
}

