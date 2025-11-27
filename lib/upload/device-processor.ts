import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { executeQuery } from "@/lib/mysql"
import crypto from "crypto"
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

  // SAVE CREDENTIALS
  logWithBroadcast(`💾 Storing ${allCredentials.length} credentials...`, "info")
  let credentialsSaved = 0
  for (const credential of allCredentials) {
    try {
      // Escape password for safe database storage
      // Allow empty password ("") as it's already validated in isValidCredentialFlexible
      const escapedPassword = escapePassword(credential.password)
      
      // Validation: only reject if password is null/undefined (not empty string)
      // Empty password ("") is valid and should be saved
      if (credential.password === undefined || credential.password === null) {
        logWithBroadcast(`⚠️ Skipping credential with null/undefined password for URL: ${credential.url}`, "warning")
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
      
      await executeQuery(
        `INSERT INTO credentials (device_id, url, domain, tld, username, password, browser, file_path) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deviceId,
          credential.url,
          credential.domain,
          credential.tld,
          truncatedUsername, // Use truncated username to fit VARCHAR(500)
          escapedPassword, // Use escaped password (can be empty string "")
          credential.browser || "Unknown",
          credential.filePath,
        ],
      )
      credentialsSaved++
    } catch (credError) {
      logWithBroadcast(`❌ Error saving credential: ${credError}`, "error")
      // Continue processing other credentials even if one fails
      continue
    }
  }

  logWithBroadcast(`✅ Successfully saved ${credentialsSaved}/${allCredentials.length} credentials`, "success")

  // Store password stats
  for (const [password, count] of passwordCounts) {
    try {
      // Escape password for safe database storage
      const escapedPassword = escapePassword(password)
      
      // Additional validation before database insertion
      if (!escapedPassword || escapedPassword.length === 0) {
        logWithBroadcast(`⚠️ Skipping password stat with empty password`, "warning")
        continue
      }
      
      // Log password info for debugging
      logPasswordInfo(password, `Saving password stat (count: ${count})`)
      
      await executeQuery(`INSERT INTO password_stats (device_id, password, count) VALUES (?, ?, ?)`, [
        deviceId,
        escapedPassword, // Use escaped password
        count,
      ])
    } catch (passwordError) {
      logWithBroadcast(`❌ Error saving password stat: ${passwordError}`, "error")
      // Continue processing other password stats even if one fails
      continue
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

  // Process all files - OPTIMIZED: All files go to disk, content = NULL in DB
  logWithBroadcast(`📁 Processing ${zipFiles.length} files for device ${deviceName}...`, "info")
  for (const zipFile of zipFiles) {
    const fileName = path.basename(zipFile.path)
    const parentPath = path.dirname(zipFile.path)

    let localFilePath: string | null = null
    let size = 0
    let fileType: "text" | "binary" | "unknown" = "unknown"

    if (!zipFile.entry.dir) {
      try {
        const isTextFile = isLikelyTextFile(fileName)
        fileType = isTextFile ? "text" : "binary"

        // ALL files go to disk (optimized approach)
        let fileData: string | Uint8Array

        if (isTextFile) {
          // Text files: read as text, save to disk
          const content = await zipFile.entry.async("text")
          if (content === null) {
            size = 0
            logWithBroadcast(`⚠️ Text file is null: ${zipFile.path}`, "warning")
            continue // Skip this file
          }
          fileData = content
          size = content.length
          logWithBroadcast(`📄 Text file: ${zipFile.path} (${size} bytes)`, "info")
        } else {
          // Binary files: read as binary, save to disk
          const binaryData = await zipFile.entry.async("uint8array")
          fileData = binaryData
          size = binaryData.length
          logWithBroadcast(`💾 Binary file: ${zipFile.path} (${size} bytes)`, "info")
        }

        // Create safe file path
        const safeFilePath = zipFile.path.replace(/[<>:"|?*]/g, "_")
        const fullLocalPath = path.join(deviceDir, safeFilePath)

        // Create directory structure if needed
        const fileDir = path.dirname(fullLocalPath)
        if (!existsSync(fileDir)) {
          await mkdir(fileDir, { recursive: true })
        }

        // Save file to disk (text or binary)
        if (isTextFile) {
          await writeFile(fullLocalPath, fileData as string, "utf-8")
        } else {
          await writeFile(fullLocalPath, fileData as Uint8Array)
          deviceBinaryFiles++
        }

        localFilePath = path.relative(process.cwd(), fullLocalPath)
        logWithBroadcast(`💾 File saved to disk: ${zipFile.path} -> ${localFilePath} (${size} bytes, ${fileType})`, "info")
      } catch (error) {
        logWithBroadcast(`❌ Error processing file ${zipFile.path}: ${error}`, "error")
      }
    }

    try {
      // Save to DB: content = NULL, local_file_path = path, file_type = type
      await executeQuery(
        `INSERT INTO files (device_id, file_path, file_name, parent_path, is_directory, file_size, content, local_file_path, file_type) 
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        [deviceId, zipFile.path, fileName, parentPath, zipFile.entry.dir, size, localFilePath, fileType],
      )
    } catch (fileError) {
      logWithBroadcast(`❌ Error saving file record: ${fileError}`, "error")
      throw fileError // Re-throw to ensure we know about schema issues
    }
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

  return {
    deviceCredentials,
    deviceDomains,
    deviceUrls,
    deviceBinaryFiles,
  }
}

