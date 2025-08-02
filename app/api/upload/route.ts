import { type NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir, unlink } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { executeQuery, initializeDatabase } from "@/lib/mysql"
import crypto from "crypto"
import JSZip from "jszip"
import { broadcastLogToSession, closeLogSession } from "@/lib/upload-connections"
import { processSoftwareFiles } from "@/lib/software-parser"
import { validateRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const sessionId = (formData.get("sessionId") as string) || "default"

  // Helper function for logging with broadcast
  const logWithBroadcast = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    console.log(message)
    broadcastLogToSession(sessionId, message, type)
  }

  let uploadedFilePath: string | null = null

  // Small delay to ensure log stream connection is established
  await new Promise(resolve => setTimeout(resolve, 200))

  logWithBroadcast("🚀 Upload API called", "info")

  try {
    await initializeDatabase()

    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json({ error: "Only .zip files are allowed" }, { status: 400 })
    }

    logWithBroadcast("📦 File received: " + file.name + " Size: " + file.size, "info")

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "uploads")
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Save uploaded file temporarily
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    uploadedFilePath = path.join(uploadsDir, file.name)
    await writeFile(uploadedFilePath, buffer)

    // Generate unique upload batch ID
    const uploadBatch = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    // Process the zip file with enhanced binary file storage
    const processingResult = await processZipWithBinaryStorage(bytes, uploadBatch, logWithBroadcast)

    // CLEANUP: Delete the uploaded ZIP file after successful processing
    try {
      await unlink(uploadedFilePath)
      logWithBroadcast(`🗑️ Cleaned up uploaded ZIP file: ${uploadedFilePath}`, "info")
    } catch (cleanupError) {
      logWithBroadcast(`⚠️ Failed to cleanup ZIP file: ${cleanupError}`, "warning")
    }

    // Close log session
    setTimeout(() => closeLogSession(sessionId), 1000)

    return NextResponse.json({
      success: true,
      details: processingResult,
    })
  } catch (error) {
    logWithBroadcast("💥 Upload processing error:" + error, "error")

    // CLEANUP: Delete the uploaded ZIP file on error too
    if (uploadedFilePath) {
      try {
        await unlink(uploadedFilePath)
        logWithBroadcast(`🗑️ Cleaned up ZIP file after error: ${uploadedFilePath}`, "info")
      } catch (cleanupError) {
        logWithBroadcast(`⚠️ Failed to cleanup ZIP file after error: ${cleanupError}`, "warning")
      }
    }

    // Close log session
    setTimeout(() => closeLogSession(sessionId), 1000)

    return NextResponse.json(
      {
        error: "Processing failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

async function processZipWithBinaryStorage(
  arrayBuffer: ArrayBuffer,
  uploadBatch: string,
  logWithBroadcast: (message: string, type?: "info" | "success" | "warning" | "error") => void,
) {
  try {
    logWithBroadcast(
      `🚀 Processing ZIP file with BINARY STORAGE SUPPORT, size: ${arrayBuffer.byteLength} bytes`,
      "info",
    )

    const zip = new JSZip()
    const zipData = await zip.loadAsync(arrayBuffer)

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
        continue
      }

      if (!deviceMap.has(deviceName)) {
        deviceMap.set(deviceName, [])
        logWithBroadcast(`📱 New device detected: "${deviceName}" (device #${deviceMap.size})`, "info")
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

      // Create device-specific directory
      const deviceDir = path.join(extractionBaseDir, deviceId)
      logWithBroadcast(`📁 Creating device directory: ${deviceDir}`, "info")
      if (!existsSync(deviceDir)) {
        await mkdir(deviceDir, { recursive: true })
      }

      // Find password files
      const passwordFiles = zipFiles.filter((file) => {
        const fileName = path.basename(file.path)
        const lowerFileName = fileName.toLowerCase()

        const isPasswordFile =
          lowerFileName === "all passwords.txt" ||
          lowerFileName === "all_passwords.txt" ||
          lowerFileName === "passwords.txt"

        if (isPasswordFile) {
          logWithBroadcast(`✅ Found password file: ${file.path}`, "success")
        }

        return isPasswordFile && !file.entry.dir
      })

      logWithBroadcast(`🔍 Found ${passwordFiles.length} password files in device: ${deviceName}`, "info")

      let deviceCredentials = 0
      let deviceDomains = 0
      let deviceUrls = 0
      let deviceBinaryFiles = 0
      const passwordCounts = new Map<string, number>()
      const allCredentials: Array<{
        url: string
        domain: string | null
        tld: string | null
        username: string
        password: string
        browser: string | null
        filePath: string
      }> = []

      // Process credentials from password files
      for (const passwordFile of passwordFiles) {
        try {
          logWithBroadcast(`📖 Processing password file: ${passwordFile.path}`, "info")
          const content = await passwordFile.entry.async("text")
          logWithBroadcast(`📝 File content length: ${content.length}`, "info")

          const stats = analyzePasswordFile(content)
          logWithBroadcast(`📊 File stats: ${JSON.stringify(stats)}`, "info")

          deviceCredentials += stats.credentialCount
          deviceDomains += stats.domainCount
          deviceUrls += stats.urlCount

          // Merge password counts
          for (const [password, count] of stats.passwordCounts) {
            passwordCounts.set(password, (passwordCounts.get(password) || 0) + count)
          }

          // Collect all credentials with file path
          for (const credential of stats.credentials) {
            allCredentials.push({
              ...credential,
              filePath: passwordFile.path,
            })
          }

          logWithBroadcast(`📝 Collected ${stats.credentials.length} credentials from ${passwordFile.path}`, "info")
        } catch (parseError) {
          logWithBroadcast(`❌ Error processing password file ${passwordFile.path}: ${parseError}`, "error")
        }
      }

      logWithBroadcast(
        `📊 Device ${deviceName} totals: ${deviceCredentials} credentials, ${deviceDomains} domains, ${deviceUrls} URLs`,
        "info",
      )

      // INSERT DEVICE RECORD FIRST
      try {
        logWithBroadcast(`💾 Saving device record: ${deviceName}`, "info")
        await executeQuery(
          `INSERT INTO devices (device_id, device_name, device_name_hash, upload_batch, total_files, total_credentials, total_domains, total_urls) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            deviceId,
            deviceName,
            deviceHash,
            uploadBatch,
            zipFiles.length,
            deviceCredentials,
            deviceDomains,
            deviceUrls,
          ],
        )
        logWithBroadcast(`✅ Device record saved: ${deviceName}`, "success")
      } catch (deviceError) {
        logWithBroadcast(`❌ Error saving device record: ${deviceError}`, "error")
        throw deviceError
      }

      // SAVE CREDENTIALS
      logWithBroadcast(`💾 Storing ${allCredentials.length} credentials...`, "info")
      let credentialsSaved = 0
      for (const credential of allCredentials) {
        try {
          await executeQuery(
            `INSERT INTO credentials (device_id, url, domain, tld, username, password, browser, file_path) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              deviceId,
              credential.url,
              credential.domain,
              credential.tld,
              credential.username,
              credential.password,
              credential.browser || "Unknown",
              credential.filePath,
            ],
          )
          credentialsSaved++
        } catch (credError) {
          logWithBroadcast(`❌ Error saving credential: ${credError}`, "error")
        }
      }

      logWithBroadcast(`✅ Successfully saved ${credentialsSaved}/${allCredentials.length} credentials`, "success")

      // Store password stats
      for (const [password, count] of passwordCounts) {
        try {
          await executeQuery(`INSERT INTO password_stats (device_id, password, count) VALUES (?, ?, ?)`, [
            deviceId,
            password,
            count,
          ])
        } catch (passwordError) {
          logWithBroadcast(`❌ Error saving password stat: ${passwordError}`, "error")
        }
      }

      // Process software files
      logWithBroadcast(`🔍 Looking for software files in device: ${deviceName}`, "info")
      const softwareFiles = zipFiles.filter((file) => {
        const fileName = path.basename(file.path)
        const lowerFileName = fileName.toLowerCase()

        const isSoftwareFile =
          lowerFileName === "software.txt" ||
          lowerFileName === "installedsoftware.txt" ||
          lowerFileName === "installedprograms.txt" ||
          lowerFileName === "programslist.txt"

        if (isSoftwareFile) {
          logWithBroadcast(`✅ Found software file: ${file.path}`, "success")
        }

        return isSoftwareFile && !file.entry.dir
      })

      logWithBroadcast(`🔍 Found ${softwareFiles.length} software files in device: ${deviceName}`, "info")

      // Process software files
      if (softwareFiles.length > 0) {
        try {
          const softwareFileContents: { [key: string]: string } = {}
          
          for (const softwareFile of softwareFiles) {
            try {
              const content = await softwareFile.entry.async("text")
              const fileName = path.basename(softwareFile.path)
              softwareFileContents[fileName] = content
              logWithBroadcast(`📖 Loaded software file: ${fileName} (${content.length} bytes)`, "info")
            } catch (error) {
              logWithBroadcast(`❌ Error loading software file ${softwareFile.path}: ${error}`, "error")
            }
          }

          logWithBroadcast(`📁 Software files loaded: ${Object.keys(softwareFileContents).join(', ')}`, "info")

          if (Object.keys(softwareFileContents).length > 0) {
            logWithBroadcast(`🔍 Starting software processing for ${Object.keys(softwareFileContents).length} files`, "info")
            await processSoftwareFiles(deviceId, softwareFileContents)
            logWithBroadcast(`✅ Successfully processed software files for device: ${deviceName}`, "success")
          } else {
            logWithBroadcast(`⚠️ No software file contents found for device: ${deviceName}`, "warning")
          }
        } catch (softwareError) {
          logWithBroadcast(`❌ Error processing software files: ${softwareError}`, "error")
        }
      } else {
        logWithBroadcast(`⚠️ No software files found in device: ${deviceName}`, "warning")
      }

      // Process all files INCLUDING BINARY FILES with local storage
      logWithBroadcast(`📁 Processing ${zipFiles.length} files for device ${deviceName}...`, "info")
      for (const zipFile of zipFiles) {
        const fileName = path.basename(zipFile.path)
        const parentPath = path.dirname(zipFile.path)

        let content: string | null = null
        let localFilePath: string | null = null
        let size = 0

        if (!zipFile.entry.dir) {
          try {
            const isTextFile = isLikelyTextFile(fileName)

            if (isTextFile) {
              // Text files: store content in database
              content = await zipFile.entry.async("text")
              if (content === null) {
                size = 0
                logWithBroadcast(`⚠️ Text file is null: ${zipFile.path}`, "warning")
              } else {
                size = content.length
                logWithBroadcast(`📄 Text file: ${zipFile.path} (${size} bytes)`, "info")
              }
            } else {
              // Binary files: save to local storage
              const binaryData = await zipFile.entry.async("uint8array")
              size = binaryData.length

              // Create safe file path
              const safeFilePath = zipFile.path.replace(/[<>:"|?*]/g, "_")
              const fullLocalPath = path.join(deviceDir, safeFilePath)

              // Create directory structure if needed
              const fileDir = path.dirname(fullLocalPath)
              if (!existsSync(fileDir)) {
                await mkdir(fileDir, { recursive: true })
              }

              // Save binary file
              await writeFile(fullLocalPath, binaryData)
              localFilePath = path.relative(process.cwd(), fullLocalPath)
              deviceBinaryFiles++

              logWithBroadcast(`💾 Binary file saved: ${zipFile.path} -> ${localFilePath} (${size} bytes)`, "info")
            }
          } catch (error) {
            logWithBroadcast(`❌ Error processing file ${zipFile.path}: ${error}`, "error")
          }
        }

        try {
          // FIXED: Use proper column insertion with local_file_path
          await executeQuery(
            `INSERT INTO files (device_id, file_path, file_name, parent_path, is_directory, file_size, content, local_file_path) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [deviceId, zipFile.path, fileName, parentPath, zipFile.entry.dir, size, content, localFilePath],
          )
        } catch (fileError) {
          logWithBroadcast(`❌ Error saving file record: ${fileError}`, "error")
          // If local_file_path column doesn't exist, try without it
          try {
            await executeQuery(
              `INSERT INTO files (device_id, file_path, file_name, parent_path, is_directory, file_size, content) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [deviceId, zipFile.path, fileName, parentPath, zipFile.entry.dir, size, content],
            )
            logWithBroadcast(`⚠️ Saved file record without local_file_path column`, "warning")
          } catch (fallbackError) {
            logWithBroadcast(`❌ Fallback file save also failed: ${fallbackError}`, "error")
          }
        }

        if (!zipFile.entry.dir) {
          totalFiles++
        }
      }

      devicesProcessed++
      processedDevices.push(deviceName)
      totalCredentials += deviceCredentials
      totalDomains += deviceDomains
      totalUrls += deviceUrls
      totalBinaryFiles += deviceBinaryFiles

      logWithBroadcast(`✅ Processed device: ${deviceName} (${deviceBinaryFiles} binary files saved)`, "success")

      // Verify credentials were saved
      const savedCredentials = await executeQuery("SELECT COUNT(*) as count FROM credentials WHERE device_id = ?", [
        deviceId,
      ])
      logWithBroadcast(
        `🔍 Verification: ${(savedCredentials as any[])[0].count} credentials saved for device ${deviceName}`,
        "info",
      )
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

    // Clear analytics cache
    await executeQuery("DELETE FROM analytics_cache WHERE cache_key LIKE 'stats_%'")

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
    logWithBroadcast("💥 Processing error:" + error, "error")
    throw new Error(`Failed to process zip file: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Keep all helper functions the same...
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

  // FILTER OUT SYSTEM DIRECTORIES
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
    // Pre-directory structure: device name is the pre-directory itself
    if (pathParts.length <= 1) return null // No device level
    if (pathParts[0] !== structureInfo.preDirectoryName) return null // Wrong pre-directory

    // Device name is the pre-directory name (level 0)
    return pathParts[0]
  } else {
    // Direct structure: device name is at level 0
    return pathParts[0]
  }
}

function analyzePasswordFile(content: string): {
  credentialCount: number
  domainCount: number
  urlCount: number
  passwordCounts: Map<string, number>
  credentials: Array<{
    url: string
    domain: string | null
    tld: string | null
    username: string
    password: string
    browser: string | null
  }>
} {
  const result = {
    credentialCount: 0,
    domainCount: 0,
    urlCount: 0,
    passwordCounts: new Map<string, number>(),
    credentials: [] as Array<{
      url: string
      domain: string | null
      tld: string | null
      username: string
      password: string
      browser: string | null
    }>,
  }

  if (!content || content.trim().length === 0) {
    return result
  }

  const lines = content.split(/\r?\n/)

  // Count passwords (case insensitive)
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue

    const lowerLine = trimmedLine.toLowerCase()

    // Count credentials by looking for "password:" or "pass:"
    if (lowerLine.includes("password:") || lowerLine.includes("pass:")) {
      const password = extractValue(trimmedLine)
      if (password && password.length > 0) {
        result.credentialCount++
        result.passwordCounts.set(password, (result.passwordCounts.get(password) || 0) + 1)
      }
    }

    // Count URLs and domains
    if (lowerLine.includes("url:") || lowerLine.includes("host:") || lowerLine.includes("hostname:")) {
      const url = extractValue(trimmedLine)
      if (url && url.length > 0) {
        result.urlCount++

        // Check if it's not an IP address for domain count
        if (!isIpAddress(url)) {
          result.domainCount++
        }
      }
    }
  }

  // Parse credentials
  let currentCredential: Partial<{
    url: string
    username: string
    password: string
    browser: string
  }> = {}

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (!trimmedLine) {
      if (isValidCredentialFlexible(currentCredential)) {
        const urlInfo = extractUrlInfo(currentCredential.url!)
        result.credentials.push({
          url: currentCredential.url!,
          domain: urlInfo.domain,
          tld: urlInfo.tld,
          username: currentCredential.username!,
          password: currentCredential.password!,
          browser: currentCredential.browser || null,
        })
      }
      currentCredential = {}
      continue
    }

    const lowerLine = trimmedLine.toLowerCase()

    if (lowerLine.includes("url:") || lowerLine.includes("host:") || lowerLine.includes("hostname:")) {
      currentCredential.url = extractValue(trimmedLine)
    } else if (lowerLine.includes("username:") || lowerLine.includes("user:") || lowerLine.includes("login:")) {
      currentCredential.username = extractValue(trimmedLine)
    } else if (lowerLine.includes("password:") || lowerLine.includes("pass:")) {
      currentCredential.password = extractValue(trimmedLine)
    } else if (lowerLine.includes("browser:") || lowerLine.includes("soft:") || lowerLine.includes("application:")) {
      currentCredential.browser = extractValue(trimmedLine)
    }
  }

  // Add the last credential if valid
  if (isValidCredentialFlexible(currentCredential)) {
    const urlInfo = extractUrlInfo(currentCredential.url!)
    result.credentials.push({
      url: currentCredential.url!,
      domain: urlInfo.domain,
      tld: urlInfo.tld,
      username: currentCredential.username!,
      password: currentCredential.password!,
      browser: currentCredential.browser || null,
    })
  }

  return result
}

function isValidCredentialFlexible(
  credential: Partial<{
    url: string
    username: string
    password: string
    browser: string
  }>,
): credential is { url: string; username: string; password: string; browser?: string } {
  return !!(credential.url && credential.username && credential.password)
}

function isIpAddress(url: string): boolean {
  try {
    let hostname = url.trim()
    hostname = hostname.replace(/^https?:\/\//, "")
    hostname = hostname.split("/")[0]
    hostname = hostname.split(":")[0]

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    return ipRegex.test(hostname)
  } catch (error) {
    return false
  }
}

function extractUrlInfo(url: string): { domain: string | null; tld: string | null } {
  try {
    if (!url || url.trim() === "") {
      return { domain: null, tld: null }
    }

    let cleanUrl = url.trim()
    cleanUrl = cleanUrl.replace(/^https?:\/\//, "")
    cleanUrl = cleanUrl.replace(/^www\./, "")

    const hostname = cleanUrl.split("/")[0].split(":")[0].toLowerCase()

    if (isIpAddress(url)) {
      return { domain: hostname, tld: null }
    }

    const parts = hostname.split(".")
    if (parts.length >= 2) {
      const tld = parts[parts.length - 1]
      const domain = parts.length > 2 ? parts.slice(-2).join(".") : hostname
      return { domain, tld }
    }

    return { domain: hostname, tld: null }
  } catch (error) {
    return { domain: null, tld: null }
  }
}

function extractValue(line: string): string {
  const colonIndex = line.indexOf(":")
  if (colonIndex !== -1) {
    return line.substring(colonIndex + 1).trim()
  }
  return line.trim()
}

function isLikelyTextFile(fileName: string): boolean {
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
