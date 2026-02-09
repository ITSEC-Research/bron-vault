import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { executeQuery } from "@/lib/mysql"
import { processSoftwareFiles } from "@/lib/software-parser"
import { processSystemInformationFiles } from "@/lib/system-information-parser"
import {
  escapePassword,
  hasSpecialCharacters,
  logPasswordInfo,
  analyzePasswordFile,
  truncateUsername,
} from "@/lib/password-parser"
import { isLikelyTextFile } from "./zip-structure-analyzer"
import { chunkArray } from "@/lib/utils"
import { settingsManager } from "@/lib/settings"
import { getStorageProvider } from "@/lib/storage"

export interface DeviceProcessingResult {
  deviceCredentials: number
  deviceDomains: number
  deviceUrls: number
  deviceBinaryFiles: number
}

export async function processDevice(
  deviceName: string,
  zipFiles: Array<{ path: string; entry: any }>,
  deviceHash: string,
  deviceId: string,
  uploadBatch: string,
  extractionBaseDir: string,
  logWithBroadcast: (message: string, type?: "info" | "success" | "warning" | "error") => void,
): Promise<DeviceProcessingResult> {
  // Create device-specific directory
  const deviceDir = path.join(extractionBaseDir, deviceId)
  logWithBroadcast(`📁 Creating device directory: ${deviceDir}`, "info")

  // Get storage provider for file operations
  const storageProvider = await getStorageProvider()
  const storageType = storageProvider.getType()
  logWithBroadcast(`💾 Storage provider: ${storageType}`, "info")

  if (storageType === "local") {
    // Local storage: create directory on filesystem
    if (!existsSync(deviceDir)) {
      await mkdir(deviceDir, { recursive: true })
    }
  } else {
    // S3: no-op for directory creation
    await storageProvider.ensureDir(deviceDir)
  }

  // Find password files
  const passwordFiles = zipFiles.filter((file) => {
    const fileName = path.basename(file.path)
    const lowerFileName = fileName.toLowerCase()

    const isPasswordFile =
      lowerFileName === "all passwords.txt" ||
      lowerFileName === "all_passwords.txt" ||
      lowerFileName === "passwords.txt" ||
      lowerFileName === "allpasswords_list.txt" ||
      lowerFileName === "_allpasswords_list"

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
        
        // Log password info for debugging
        if (password) {
          logPasswordInfo(password, `Password stat from ${passwordFile.path}`)
        }
      }

      // Collect all credentials with file path
      for (const credential of stats.credentials) {
        allCredentials.push({
          ...credential,
          filePath: passwordFile.path,
        })
      }

      logWithBroadcast(`📝 Collected ${stats.credentials.length} credentials from ${passwordFile.path}`, "info")
      
      // Log any passwords with special characters for debugging
      for (const credential of stats.credentials) {
        if (credential.password) {
          logPasswordInfo(credential.password, `Credential from ${passwordFile.path}`)
          if (hasSpecialCharacters(credential.password)) {
            logWithBroadcast(`🔐 Found password with special characters: ${credential.password.substring(0, 5)}...`, "info")
          }
        }
      }
    } catch (parseError) {
      logWithBroadcast(`❌ Error processing password file ${passwordFile.path}: ${parseError}`, "error")
      // Continue processing other files even if one fails
      continue
    }
  }

  logWithBroadcast(
    `📊 Device ${deviceName} totals: ${deviceCredentials} credentials, ${deviceDomains} domains, ${deviceUrls} URLs`,
    "info",
  )
  
  // Log summary of passwords with special characters
  let specialCharPasswords = 0
  for (const [password] of passwordCounts) {
    if (hasSpecialCharacters(password)) {
      specialCharPasswords++
    }
  }
  if (specialCharPasswords > 0) {
    logWithBroadcast(`🔐 Found ${specialCharPasswords} passwords with special characters in device ${deviceName}`, "info")
  }

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

  // SAVE CREDENTIALS - OPTIMIZED WITH BULK INSERT
  logWithBroadcast(`💾 Storing ${allCredentials.length} credentials...`, "info")
  
  // Get batch size from settings (with fallback)
  const batchSettings = await settingsManager.getBatchSettings()
  const credentialsBatchSize = batchSettings.credentialsBatchSize
  
  // Phase 1: Prepare and validate all credentials (keep all business logic)
  const validCredentials: Array<{
    url: string
    domain: string | null
    tld: string | null
    username: string
    password: string
    browser: string | null
    filePath: string
  }> = []
  let credentialsSkipped = 0
  
  for (const credential of allCredentials) {
    try {
      // Escape password for safe database storage
      // Allow empty password ("") as it's already validated in isValidCredentialFlexible
      const escapedPassword = escapePassword(credential.password)
      
      // Validation: only reject if password is null/undefined (not empty string)
      // Empty password ("") is valid and should be saved
      if (credential.password === undefined || credential.password === null) {
        logWithBroadcast(`⚠️ Skipping credential with null/undefined password for URL: ${credential.url}`, "warning")
        credentialsSkipped++
        continue
      }
      
      // Log password info for debugging
      logPasswordInfo(credential.password, `Saving credential for ${credential.url}`)
      
      // Truncate username if it exceeds database VARCHAR(500) limit
      const context = `${credential.url || 'unknown'} (${credential.filePath || 'unknown file'})`
      const { username: truncatedUsername, wasTruncated, originalLength } = truncateUsername(
        credential.username,
        context
      )
      
      if (wasTruncated) {
        logWithBroadcast(
          `⚠️ Username truncated from ${originalLength} to 500 characters for URL: ${credential.url}`,
          "warning"
        )
      }
      
      // Collect valid credential
      validCredentials.push({
        url: credential.url,
        domain: credential.domain,
        tld: credential.tld,
        username: truncatedUsername, // Use truncated username to fit VARCHAR(500)
        password: escapedPassword, // Use escaped password (can be empty string "")
        browser: credential.browser || "Unknown",
        filePath: credential.filePath,
      })
    } catch (credError) {
      logWithBroadcast(`❌ Error processing credential: ${credError}`, "error")
      credentialsSkipped++
      // Continue processing other credentials even if one fails
      continue
    }
  }
  
  // Phase 2: Bulk insert in batches
  let credentialsSaved = 0
  const batches = chunkArray(validCredentials, credentialsBatchSize)
  logWithBroadcast(`📦 Inserting ${validCredentials.length} credentials in ${batches.length} batches (batch size: ${credentialsBatchSize})...`, "info")
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]
    try {
      // Construct bulk INSERT query
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
      const query = `
        INSERT INTO credentials (device_id, url, domain, tld, username, password, browser, file_path)
        VALUES ${placeholders}
      `
      
      // Flatten parameters array
      const params: any[] = []
      for (const cred of batch) {
        params.push(
          deviceId,
          cred.url,
          cred.domain,
          cred.tld,
          cred.username,
          cred.password,
          cred.browser,
          cred.filePath
        )
      }
      
      await executeQuery(query, params)
      credentialsSaved += batch.length
      
      if ((batchIndex + 1) % 10 === 0 || batchIndex === batches.length - 1) {
        logWithBroadcast(`📊 Progress: ${credentialsSaved}/${validCredentials.length} credentials saved (batch ${batchIndex + 1}/${batches.length})`, "info")
      }
    } catch (batchError) {
      logWithBroadcast(`❌ Error saving credentials batch ${batchIndex + 1}/${batches.length}: ${batchError}`, "error")
      // Continue with next batch even if this one fails
      // Note: Individual credentials in failed batch are lost, but we continue processing
    }
  }

  logWithBroadcast(`✅ Successfully saved ${credentialsSaved}/${allCredentials.length} credentials (${credentialsSkipped} skipped)`, "success")

  // Store password stats - OPTIMIZED WITH BULK INSERT
  const passwordStatsBatchSize = batchSettings.passwordStatsBatchSize
  
  // Phase 1: Prepare and validate all password stats (keep all business logic)
  const validPasswordStats: Array<{ password: string; count: number }> = []
  let passwordStatsSkipped = 0
  
  for (const [password, count] of passwordCounts) {
    try {
      // Escape password for safe database storage
      const escapedPassword = escapePassword(password)
      
      // Additional validation before database insertion
      if (!escapedPassword || escapedPassword.length === 0) {
        logWithBroadcast(`⚠️ Skipping password stat with empty password`, "warning")
        passwordStatsSkipped++
        continue
      }
      
      // Log password info for debugging
      logPasswordInfo(password, `Saving password stat (count: ${count})`)
      
      // Collect valid password stat
      validPasswordStats.push({
        password: escapedPassword, // Use escaped password
        count,
      })
    } catch (passwordError) {
      logWithBroadcast(`❌ Error processing password stat: ${passwordError}`, "error")
      passwordStatsSkipped++
      // Continue processing other password stats even if one fails
      continue
    }
  }
  
  // Phase 2: Bulk insert in batches
  if (validPasswordStats.length > 0) {
    const batches = chunkArray(validPasswordStats, passwordStatsBatchSize)
    logWithBroadcast(`📦 Inserting ${validPasswordStats.length} password stats in ${batches.length} batches (batch size: ${passwordStatsBatchSize})...`, "info")
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      try {
        // Construct bulk INSERT query
        const placeholders = batch.map(() => '(?, ?, ?)').join(', ')
        const query = `
          INSERT INTO password_stats (device_id, password, count)
          VALUES ${placeholders}
        `
        
        // Flatten parameters array
        const params: any[] = []
        for (const stat of batch) {
          params.push(deviceId, stat.password, stat.count)
        }
        
        await executeQuery(query, params)
      } catch (batchError) {
        logWithBroadcast(`❌ Error saving password stats batch ${batchIndex + 1}/${batches.length}: ${batchError}`, "error")
        // Continue with next batch even if this one fails
      }
    }
    
    logWithBroadcast(`✅ Successfully saved ${validPasswordStats.length} password stats (${passwordStatsSkipped} skipped)`, "success")
  } else {
    logWithBroadcast(`⚠️ No valid password stats to save`, "warning")
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

  // Process system information files
  logWithBroadcast(`🔍 Looking for system information files in device: ${deviceName}`, "info")
  const systemInfoFiles = zipFiles.filter((file) => {
    const fileName = path.basename(file.path)
    const lowerFileName = fileName.toLowerCase()

    const isSystemInfoFile =
      lowerFileName.includes('system') ||
      lowerFileName.includes('information') ||
      lowerFileName.includes('userinfo') ||
      lowerFileName.includes('user_info') ||
      lowerFileName.includes('systeminfo') ||
      lowerFileName.includes('system_info') ||
      lowerFileName.includes('info.txt') ||
      lowerFileName.endsWith('_information.txt') ||
      lowerFileName === 'information.txt' ||
      lowerFileName === 'system.txt' ||
      lowerFileName === 'userinformation.txt'

    if (isSystemInfoFile) {
      logWithBroadcast(`✅ Found system information file: ${file.path}`, "success")
    }

    return isSystemInfoFile && !file.entry.dir
  })

  logWithBroadcast(`🔍 Found ${systemInfoFiles.length} system information files in device: ${deviceName}`, "info")

  // Process system information files
  if (systemInfoFiles.length > 0) {
    try {
      const systemInfoFileContents: Array<{ fileName: string; content: string }> = []
      
      for (const systemInfoFile of systemInfoFiles) {
        try {
          const content = await systemInfoFile.entry.async("text")
          const fileName = path.basename(systemInfoFile.path)
          systemInfoFileContents.push({ fileName, content })
          logWithBroadcast(`📖 Loaded system information file: ${fileName} (${content.length} bytes)`, "info")
        } catch (error) {
          logWithBroadcast(`❌ Error loading system information file ${systemInfoFile.path}: ${error}`, "error")
        }
      }

      logWithBroadcast(`📁 System information files loaded: ${systemInfoFileContents.length} files`, "info")

      if (systemInfoFileContents.length > 0) {
        logWithBroadcast(`🔍 Starting system information processing for ${systemInfoFileContents.length} files`, "info")
        const systemInfoResults = await processSystemInformationFiles(deviceId, systemInfoFileContents)
        logWithBroadcast(`✅ Successfully processed system information files for device: ${deviceName} (${systemInfoResults.success} success, ${systemInfoResults.failed} failed)`, "success")
        
        if (systemInfoResults.errors.length > 0) {
          logWithBroadcast(`⚠️ System information processing errors: ${systemInfoResults.errors.length} errors`, "warning")
          systemInfoResults.errors.forEach(err => {
            logWithBroadcast(`  - ${err.fileName}: ${err.error}`, "warning")
          })
        }
      } else {
        logWithBroadcast(`⚠️ No system information file contents found for device: ${deviceName}`, "warning")
      }
    } catch (systemInfoError) {
      logWithBroadcast(`❌ Error processing system information files: ${systemInfoError}`, "error")
    }
  } else {
    logWithBroadcast(`⚠️ No system information files found in device: ${deviceName}`, "warning")
  }

  // Process all files - OPTIMIZED: Pipeline Pattern (Read → Write → Free Memory)
  logWithBroadcast(`📁 Processing ${zipFiles.length} files for device ${deviceName}...`, "info")
  
  const fileWriteParallelLimit = batchSettings.fileWriteParallelLimit
  const filesBatchSize = batchSettings.filesBatchSize
  
  // File metadata for bulk insert (only metadata, NO file data)
  interface FileMetadata {
    zipFile: { path: string; entry: any }
    fileName: string
    parentPath: string
    localFilePath: string | null
    size: number
    fileType: "text" | "binary" | "unknown"
    isDirectory: boolean
    error?: string
  }
  
  const fileMetadataList: FileMetadata[] = []
  
  // Pipeline: Read → Write → Free Memory (per chunk)
  // Process files in chunks to avoid memory buildup
  for (let i = 0; i < zipFiles.length; i += fileWriteParallelLimit) {
    const chunk = zipFiles.slice(i, i + fileWriteParallelLimit)
    
    // Process each chunk: Read → Write → Free Memory immediately
    const chunkPromises = chunk.map(async (zipFile): Promise<FileMetadata> => {
      const fileName = path.basename(zipFile.path)
      const parentPath = path.dirname(zipFile.path)
      
      // Handle directories (no read/write needed)
      if (zipFile.entry.dir) {
        return {
          zipFile,
          fileName,
          parentPath,
          localFilePath: null,
          size: 0,
          fileType: "unknown",
          isDirectory: true,
        }
      }
      
      // Pipeline: Read → Write → Free Memory
      try {
        const isTextFile = isLikelyTextFile(fileName)
        const fileType = isTextFile ? "text" : "binary"
        let fileData: string | Uint8Array | null = null
        let size = 0
        
        // Step 1: Read file data
        if (isTextFile) {
          const content = await zipFile.entry.async("text")
          if (content === null) {
            logWithBroadcast(`⚠️ Text file is null: ${zipFile.path}`, "warning")
            return {
              zipFile,
              fileName,
              parentPath,
              localFilePath: null,
              size: 0,
              fileType: "unknown",
              isDirectory: false,
              error: "Text file is null",
            }
          }
          fileData = content
          size = content.length
          logWithBroadcast(`📄 Text file: ${zipFile.path} (${size} bytes)`, "info")
        } else {
          const binaryData = await zipFile.entry.async("uint8array")
          fileData = binaryData
          size = binaryData.length
          logWithBroadcast(`💾 Binary file: ${zipFile.path} (${size} bytes)`, "info")
        }
        
        // Step 2: Write to storage immediately (while data is still in scope)
        const safeFilePath = zipFile.path.replace(/[<>:"|?*]/g, "_")
        const fullLocalPath = path.join(deviceDir, safeFilePath)
        
        // Compute the storage key (relative path from project root)
        const localFilePath = path.relative(process.cwd(), fullLocalPath)
        
        if (storageType === "local") {
          // Local filesystem: create directory structure and write file
          const fileDir = path.dirname(fullLocalPath)
          if (!existsSync(fileDir)) {
            await mkdir(fileDir, { recursive: true })
          }
          
          if (fileType === "text") {
            await writeFile(fullLocalPath, fileData as string, "utf-8")
          } else {
            await writeFile(fullLocalPath, fileData as Uint8Array)
            deviceBinaryFiles++
          }
        } else {
          // S3: upload using storage provider with the relative key
          if (fileType === "text") {
            await storageProvider.put(localFilePath, fileData as string, "text/plain")
          } else {
            const buffer = Buffer.from(fileData as Uint8Array)
            await storageProvider.put(localFilePath, buffer)
            deviceBinaryFiles++
          }
        }
        
        logWithBroadcast(`💾 File saved to ${storageType}: ${zipFile.path} -> ${localFilePath} (${size} bytes, ${fileType})`, "info")
        
        // Step 3: fileData goes out of scope here → memory freed automatically
        // Only save metadata (no file data)
        return {
          zipFile,
          fileName,
          parentPath,
          localFilePath,
          size,
          fileType,
          isDirectory: false,
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logWithBroadcast(`❌ Error processing file ${zipFile.path}: ${errorMsg}`, "error")
        return {
          zipFile,
          fileName,
          parentPath,
          localFilePath: null,
          size: 0,
          fileType: "unknown",
          isDirectory: false,
          error: errorMsg,
        }
      }
    })
    
    // Wait for chunk to complete (read + write), then memory is freed
    const chunkResults = await Promise.allSettled(chunkPromises)
    for (const result of chunkResults) {
      if (result.status === "fulfilled") {
        // Only metadata is stored (no file data)
        fileMetadataList.push(result.value)
      } else {
        logWithBroadcast(`❌ Error in file processing promise: ${result.reason}`, "error")
      }
    }
    
    // At this point, all fileData from this chunk is out of scope → memory freed
  }
  
  // Phase 2: Bulk insert file metadata (only metadata, no file data)
  const validFileMetadata = fileMetadataList.filter(f => !f.error)
  
  if (validFileMetadata.length > 0) {
    const batches = chunkArray(validFileMetadata, filesBatchSize)
    logWithBroadcast(`📦 Inserting ${validFileMetadata.length} file records in ${batches.length} batches (batch size: ${filesBatchSize})...`, "info")
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      try {
        // Construct bulk INSERT query
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, NULL, ?, ?)').join(', ')
        const query = `
          INSERT INTO files (device_id, file_path, file_name, parent_path, is_directory, file_size, content, local_file_path, file_type)
          VALUES ${placeholders}
        `
        
        // Flatten parameters array
        const params: any[] = []
        for (const file of batch) {
          params.push(
            deviceId,
            file.zipFile.path,
            file.fileName,
            file.parentPath,
            file.isDirectory,
            file.size,
            file.localFilePath,
            file.fileType
          )
        }
        
        await executeQuery(query, params)
      } catch (batchError) {
        logWithBroadcast(`❌ Error saving files batch ${batchIndex + 1}/${batches.length}: ${batchError}`, "error")
        // Re-throw to ensure we know about schema issues (same as original behavior)
        throw batchError
      }
    }
    
    logWithBroadcast(`✅ Successfully saved ${validFileMetadata.length} file records`, "success")
  } else {
    logWithBroadcast(`⚠️ No valid file records to save`, "warning")
  }

  logWithBroadcast(`✅ Processed device: ${deviceName} (${deviceBinaryFiles} binary files saved)`, "success")

  // Verify credentials were saved
  const savedCredentials = await executeQuery("SELECT COUNT(*) as count FROM credentials WHERE device_id = ?", [
    deviceId,
  ])
  logWithBroadcast(
    `🔍 Verification: ${(savedCredentials as any[])[0].count} credentials saved for device ${deviceName}`,
    "info",
  )

  // Domain monitor checks are now deferred to batch level (after all devices are processed)
  // See checkMonitorsForBatch() in domain-monitor.ts - called from zip-processor after upload completes

  return {
    deviceCredentials,
    deviceDomains,
    deviceUrls,
    deviceBinaryFiles,
  }
}

