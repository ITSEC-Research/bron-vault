import { type NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import JSZip from "jszip"
import { validateRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { deviceId } = await request.json()

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID is required" }, { status: 400 })
    }

    console.log(`📦 Creating comprehensive ZIP download for device: ${deviceId}`)

    // Get device info
    const deviceInfo = await executeQuery("SELECT device_name FROM devices WHERE device_id = ?", [deviceId])

    if (!deviceInfo || (deviceInfo as any[]).length === 0) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 })
    }

    const deviceName = (deviceInfo as any[])[0].device_name

    // Get all files for this device (both text and binary)
    const allFiles = await executeQuery(
      `SELECT file_path, file_name, content, local_file_path, is_directory, file_size 
       FROM files 
       WHERE device_id = ? AND is_directory = FALSE
       ORDER BY file_path`,
      [deviceId],
    )

    // Get all credentials for this device
    const credentials = await executeQuery(
      "SELECT url, username, password, browser FROM credentials WHERE device_id = ?",
      [deviceId],
    )

    // Get all software for this device
    const software = await executeQuery(
      "SELECT software_name, version, source_file FROM software WHERE device_id = ?",
      [deviceId],
    )

    // Get system information for this device
    const systemInfo = await executeQuery(
      `SELECT stealer_type, os, ip_address, username, cpu, ram, computer_name, 
              gpu, country, log_date, hwid, file_path, antivirus
       FROM systeminformation 
       WHERE device_id = ? 
       LIMIT 1`,
      [deviceId],
    )

    // Calculate software statistics (total and unique)
    const totalSoftware = (software as any[]).length
    const uniqueSoftwareSet = new Set<string>()
    for (const sw of software as any[]) {
      const key = `${sw.software_name}|${sw.version || 'N/A'}`
      uniqueSoftwareSet.add(key)
    }
    const uniqueSoftware = uniqueSoftwareSet.size

    console.log(
      `📊 Creating comprehensive ZIP with ${(allFiles as any[]).length} files, ${(credentials as any[]).length} credentials, and ${totalSoftware} software entries`,
    )

    // Create ZIP
    const zip = new JSZip()

    // Separate text files and binary files
    const textFiles = (allFiles as any[]).filter((f) => f.content && !f.local_file_path)
    const binaryFiles = (allFiles as any[]).filter((f) => f.local_file_path)

    console.log(`📄 Text files: ${textFiles.length}, Binary files: ${binaryFiles.length}`)

    // 1. Create SUMMARY.txt (general information)
    let summaryContent = `=== DEVICE EXTRACTION SUMMARY ===\n`
    summaryContent += `Device Name: ${deviceName}\n`
    summaryContent += `Device ID: ${deviceId}\n`
    summaryContent += `Extraction Date: ${new Date().toISOString()}\n`
    summaryContent += `Total Files: ${(allFiles as any[]).length}\n`
    summaryContent += `Text Files: ${textFiles.length}\n`
    summaryContent += `Binary Files: ${binaryFiles.length}\n`
    summaryContent += `Credentials Found: ${(credentials as any[]).length}\n`
    summaryContent += `Software Installed (Total): ${totalSoftware}\n`
    summaryContent += `Software Installed (Unique): ${uniqueSoftware}\n\n`

    // Add System Information section
    if ((systemInfo as any[]).length > 0) {
      const sysInfo = (systemInfo as any[])[0]
      summaryContent += `=== SYSTEM INFORMATION ===\n`
      summaryContent += `Stealer Type: ${sysInfo.stealer_type || 'N/A'}\n`
      summaryContent += `OS: ${sysInfo.os || 'N/A'}\n`
      summaryContent += `IP Address: ${sysInfo.ip_address || 'N/A'}\n`
      summaryContent += `Username: ${sysInfo.username || 'N/A'}\n`
      summaryContent += `CPU: ${sysInfo.cpu || 'N/A'}\n`
      summaryContent += `RAM: ${sysInfo.ram || 'N/A'}\n`
      summaryContent += `Computer Name: ${sysInfo.computer_name || 'N/A'}\n`
      summaryContent += `GPU: ${sysInfo.gpu || 'N/A'}\n`
      summaryContent += `Country: ${sysInfo.country || 'N/A'}\n`
      summaryContent += `Log Date: ${sysInfo.log_date || 'N/A'}\n`
      summaryContent += `HWID: ${sysInfo.hwid || 'N/A'}\n`
      summaryContent += `File Path: ${sysInfo.file_path || 'N/A'}\n`
      summaryContent += `Antivirus: ${sysInfo.antivirus || 'N/A'}\n\n`
    }

    // Add file structure
    summaryContent += `=== FILE STRUCTURE ===\n`
    for (const file of allFiles as any[]) {
      const sizeInfo = file.file_size ? ` (${formatFileSize(file.file_size)})` : ""
      const typeInfo = file.content ? " [TEXT]" : " [BINARY]"
      summaryContent += `📄 ${file.file_path}${sizeInfo}${typeInfo}\n`
    }
    summaryContent += `\n`

    summaryContent += `=== EXTRACTION NOTES ===\n`
    summaryContent += `- Text files are stored with full content\n`
    summaryContent += `- Binary files are extracted from original ZIP\n`
    summaryContent += `- Credentials are parsed from password files\n`
    summaryContent += `- All files maintain original directory structure\n`

    zip.file("SUMMARY.txt", summaryContent)

    // 2. Create CREDENTIALS.json (structured data for tools) - ENHANCED with TLD
    if ((credentials as any[]).length > 0) {
      // Calculate unique domains and TLDs for statistics
      const uniqueDomains = new Set<string>()
      const uniqueTLDs = new Set<string>()

      const processedCredentials = (credentials as any[]).map((cred, index) => {
        const urlInfo = extractUrlInfo(cred.url)

        // Add to unique sets for statistics
        if (urlInfo.domain) {
          uniqueDomains.add(urlInfo.domain)
        }
        if (urlInfo.tld) {
          uniqueTLDs.add(urlInfo.tld)
        }

        return {
          id: index + 1,
          url: cred.url,
          username: cred.username,
          password: cred.password,
          browser: cred.browser,
          domain: urlInfo.domain,
          tld: urlInfo.tld, // NEW: Added TLD field
        }
      })

      const credentialsData = {
        device: {
          id: deviceId,
          name: deviceName,
          extractionDate: new Date().toISOString(),
        },
        statistics: {
          totalCredentials: (credentials as any[]).length,
          uniqueDomains: uniqueDomains.size,
          uniqueTLDs: uniqueTLDs.size, // NEW: Added TLD statistics
          topTLDs: getTopTLDs(processedCredentials), // NEW: Top TLD analysis
        },
        credentials: processedCredentials,
      }

      zip.file("CREDENTIALS.json", JSON.stringify(credentialsData, null, 2))
    }

    // 3. Add text files to ZIP
    console.log(`📄 Adding ${textFiles.length} text files...`)
    for (const file of textFiles) {
      if (file.content) {
        zip.file(file.file_path, file.content)
      }
    }

    // 4. Add binary files to ZIP
    console.log(`💾 Adding ${binaryFiles.length} binary files...`)
    let binaryFilesAdded = 0
    let binaryFilesSkipped = 0

    for (const file of binaryFiles) {
      if (file.local_file_path) {
        try {
          const fullPath = path.join(process.cwd(), file.local_file_path)

          if (existsSync(fullPath)) {
            const binaryData = await readFile(fullPath)
            zip.file(file.file_path, binaryData)
            binaryFilesAdded++
            console.log(`✅ Added binary file: ${file.file_path}`)
          } else {
            console.warn(`⚠️ Binary file not found: ${fullPath}`)
            binaryFilesSkipped++
          }
        } catch (error) {
          console.error(`❌ Error reading binary file ${file.local_file_path}:`, error)
          binaryFilesSkipped++
        }
      }
    }

    console.log(`📊 Binary files: ${binaryFilesAdded} added, ${binaryFilesSkipped} skipped`)

    // Generate ZIP
    const zipBuffer = await zip.generateAsync({
      type: "arraybuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })

    console.log(`✅ Comprehensive ZIP created successfully, size: ${formatFileSize(zipBuffer.byteLength)}`)

    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${deviceName}_complete_extraction.zip"`,
        "Content-Length": zipBuffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error("❌ Device download error:", error)
    return NextResponse.json(
      {
        error: "Failed to create device download",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// NEW: Helper function to get top TLDs from credentials
function getTopTLDs(credentials: any[]): Array<{ tld: string | null; count: number }> {
  const tldCounts = new Map<string | null, number>()

  for (const cred of credentials) {
    const tld = cred.tld
    tldCounts.set(tld, (tldCounts.get(tld) || 0) + 1)
  }

  return Array.from(tldCounts.entries())
    .map(([tld, count]) => ({ tld, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10) // Top 10 TLDs
}

// ENHANCED: URL info extraction with better IP detection
function extractUrlInfo(url: string): { domain: string | null; tld: string | null } {
  try {
    if (!url || url.trim() === "") {
      return { domain: null, tld: null }
    }

    let cleanUrl = url.trim()
    cleanUrl = cleanUrl.replace(/^https?:\/\//, "")
    cleanUrl = cleanUrl.replace(/^www\./, "")

    const hostname = cleanUrl.split("/")[0].split(":")[0].toLowerCase()

    // Check if it's an IP address
    if (isIpAddress(hostname)) {
      return { domain: hostname, tld: null } // IP addresses have no TLD
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

// ENHANCED: Better IP address detection
function isIpAddress(hostname: string): boolean {
  try {
    // IPv4 pattern
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (ipv4Regex.test(hostname)) {
      // Validate each octet is 0-255
      const octets = hostname.split(".")
      return octets.every((octet) => {
        const num = Number.parseInt(octet, 10)
        return num >= 0 && num <= 255
      })
    }

    // IPv6 pattern (basic check)
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
    if (ipv6Regex.test(hostname)) {
      return true
    }

    // IPv6 compressed format (basic check)
    if (hostname.includes("::")) {
      return /^[0-9a-fA-F:]+$/.test(hostname)
    }

    return false
  } catch (error) {
    return false
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
