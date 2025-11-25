import { mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { executeQuery } from "@/lib/mysql"
import crypto from "crypto"
import JSZip from "jszip"
import {
  analyzeZipStructureWithMacOSSupport,
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

export async function processZipWithBinaryStorage(
  arrayBuffer: ArrayBuffer,
  uploadBatch: string,
  logWithBroadcast: (message: string, type?: "info" | "success" | "warning" | "error") => void,
): Promise<ProcessingResult> {
  try {
    const fileSizeMB = (arrayBuffer.byteLength / (1024 * 1024)).toFixed(2)
    logWithBroadcast(
      `🚀 Processing ZIP file with BINARY STORAGE SUPPORT, size: ${arrayBuffer.byteLength} bytes (${fileSizeMB} MB)`,
      "info",
    )

    logWithBroadcast("📦 Loading ZIP file into JSZip...", "info")
    const zip = new JSZip()
    let zipData
    try {
      zipData = await zip.loadAsync(arrayBuffer)
      logWithBroadcast(`✅ ZIP loaded successfully, total entries: ${Object.keys(zipData.files).length}`, "success")
    } catch (zipLoadError) {
      const errorMsg = zipLoadError instanceof Error ? zipLoadError.message : String(zipLoadError)
      logWithBroadcast(`❌ Failed to load ZIP file: ${errorMsg}`, "error")
      if (zipLoadError instanceof Error && zipLoadError.stack) {
        logWithBroadcast(`📋 Error stack: ${zipLoadError.stack}`, "error")
      }
      throw new Error(`Failed to load ZIP file: ${errorMsg}`)
    }

    logWithBroadcast(`📦 ZIP loaded successfully, total entries: ${Object.keys(zipData.files).length}`, "info")

    // Create extraction directory structure: uploads/extracted_files/YYYY-MM-DD/batch_xxx/
    const today = new Date().toISOString().split("T")[0] // YYYY-MM-DD
    const extractionBaseDir = path.join(process.cwd(), "uploads", "extracted_files", today, uploadBatch)

    logWithBroadcast(`📁 Creating extraction directory: ${extractionBaseDir}`, "info")
    if (!existsSync(extractionBaseDir)) {
      await mkdir(extractionBaseDir, { recursive: true })
    }

    // ENHANCED STRUCTURE ANALYSIS with macOS Support
    const structureInfo = analyzeZipStructureWithMacOSSupport(zipData)
    logWithBroadcast(`🧠 ZIP Structure Analysis: ${JSON.stringify(structureInfo)}`, "info")

    let devicesFound = 0
    let devicesSkipped = 0
    let devicesProcessed = 0
    let totalFiles = 0
    let totalCredentials = 0
    let totalDomains = 0
    let totalUrls = 0
    let totalBinaryFiles = 0
    const processedDevices: string[] = []
    const skippedDevices: string[] = []

    // Group files by device using ENHANCED DETECTION
    const deviceMap = new Map<string, any[]>()

    logWithBroadcast(`🔍 Starting to group files by device using ${structureInfo.structureType} structure...`, "info")
    logWithBroadcast(`🍎 macOS ZIP detected: ${structureInfo.macOSDetected}`, "info")
    let entryCount = 0

    for (const [relativePath, zipEntry] of Object.entries(zipData.files)) {
      entryCount++
      if (entryCount % 1000 === 0) {
        logWithBroadcast(`📊 Processed ${entryCount} entries so far...`, "info")
      }

      const pathParts = relativePath.split("/").filter((part) => part.length > 0)
      if (pathParts.length === 0) {
        logWithBroadcast(`⚠️ Skipping entry with empty path: "${relativePath}"`, "warning")
        continue
      }

      // ENHANCED DEVICE NAME EXTRACTION with macOS Support
      const deviceName = extractDeviceNameWithMacOSSupport(pathParts, structureInfo)
      if (!deviceName) {
        // Skip files that don't belong to any device (e.g., macOS metadata, root files)
        if (pathParts[0] === ".DS_Store" || pathParts[0].startsWith(".")) {
          logWithBroadcast(`🚫 Skipping system file: ${relativePath}`, "info")
        }
        continue
      }

      if (!deviceMap.has(deviceName)) {
        deviceMap.set(deviceName, [])
        logWithBroadcast(`📱 New device detected: "${deviceName}" (device #${deviceMap.size})`, "info")
      } else {
        logWithBroadcast(`📁 Adding file to existing device: "${deviceName}"`, "info")
      }

      deviceMap.get(deviceName)?.push({
        path: relativePath,
        entry: zipEntry,
      })
    }

    devicesFound = deviceMap.size
    logWithBroadcast(`✅ Device grouping complete:`, "success")
    logWithBroadcast(`   - Total entries processed: ${entryCount}`, "info")
    logWithBroadcast(`   - Total devices found: ${devicesFound}`, "info")
    logWithBroadcast(`   - Structure type: ${structureInfo.structureType}`, "info")
    logWithBroadcast(`   - macOS ZIP: ${structureInfo.macOSDetected}`, "info")
    logWithBroadcast(`   - Device names sample: ${Array.from(deviceMap.keys()).slice(0, 10)}`, "info")

    // Check for existing devices to avoid duplicates
    const deviceNames = Array.from(deviceMap.keys())
    logWithBroadcast(`🔍 Checking for existing devices among ${deviceNames.length} devices...`, "info")

    const deviceHashes = deviceNames.map((name) => ({
      name,
      hash: crypto.createHash("sha256").update(name.toLowerCase()).digest("hex"),
    }))

    logWithBroadcast(`🔐 Generated ${deviceHashes.length} device hashes`, "info")

    // Query existing devices
    let existingDeviceHashes = new Set()
    if (deviceHashes.length > 0) {
      logWithBroadcast(`🔍 Querying database for existing devices...`, "info")

      const existingDevicesQuery = `
        SELECT device_name_hash, device_name 
        FROM devices 
        WHERE device_name_hash IN (${deviceHashes.map(() => "?").join(",")})
      `
      const existingDevices = (await executeQuery(
        existingDevicesQuery,
        deviceHashes.map((d) => d.hash),
      )) as any[]

      logWithBroadcast(`📊 Database query result: ${existingDevices.length} existing devices found`, "info")

      existingDeviceHashes = new Set(existingDevices.map((d) => d.device_name_hash))
      logWithBroadcast(`📊 Created Set with ${existingDeviceHashes.size} existing device hashes`, "info")
    }

    // Process each device
    logWithBroadcast(`🔄 Starting to process ${deviceMap.size} devices...`, "info")
    let deviceIndex = 0

    for (const [deviceName, zipFiles] of deviceMap) {
      deviceIndex++
      logWithBroadcast(`\n🖥️ Processing device ${deviceIndex}/${deviceMap.size}: "${deviceName}"`, "info")

      // Progress log per device (ALWAYS send this)
      logWithBroadcast(`[PROGRESS] ${deviceIndex}/${deviceMap.size}`, "info")

      const deviceHash = crypto.createHash("sha256").update(deviceName.toLowerCase()).digest("hex")

      // Skip if device already exists
      if (existingDeviceHashes.has(deviceHash)) {
        logWithBroadcast(`⏭️ SKIPPING duplicate device: "${deviceName}"`, "warning")
        devicesSkipped++
        skippedDevices.push(deviceName)
        continue
      }

      logWithBroadcast(`✅ Device "${deviceName}" is NEW, proceeding with processing...`, "success")
      logWithBroadcast(`📁 Device has ${zipFiles.length} files/folders`, "info")

      // Generate unique device ID
      const deviceId = `device_${uploadBatch}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Process device using device-processor
      const deviceResult: DeviceProcessingResult = await processDevice(
        deviceName,
        zipFiles,
        deviceHash,
        deviceId,
        uploadBatch,
        extractionBaseDir,
        logWithBroadcast,
      )

      // Count files (non-directory entries)
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
    logWithBroadcast(`   - Password handling: Enhanced with special character support`, "info")

    // Clear all analytics cache to ensure fresh data after upload
    // This ensures users see new data immediately, not cached old data
    await executeQuery("DELETE FROM analytics_cache WHERE cache_key IN ('stats_main', 'browser_analysis', 'software_analysis', 'top_tlds')")

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
    
    // Check for common error types
    if (errorMessage.includes("memory") || errorMessage.includes("allocation") || errorMessage.includes("heap") || errorMessage.includes("out of memory")) {
      logWithBroadcast(
        "💡 TIP: File terlalu besar untuk diproses. JSZip memuat seluruh file ke memory. Untuk file > 1GB, pertimbangkan menggunakan streaming ZIP reader.",
        "warning"
      )
    }
    
    throw new Error(`Failed to process zip file: ${errorMessage}`)
  }
}
