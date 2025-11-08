import { type NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { query, type } = await request.json()

    if (!query || !type) {
      return NextResponse.json({ error: "Query and type are required" }, { status: 400 })
    }

    console.log(`🔍 Searching for: "${query}" by ${type}`)

    let searchResults: any[]

    if (type === "email") {
      // Search for email in file content - look in ALL text files, not just credentials table
      searchResults = await executeQuery(
        `
        SELECT 
          d.device_id,
          d.device_name,
          d.upload_batch,
          d.upload_date,
          c.username,
          c.url,
          c.password,
          c.browser,
          c.file_path
        FROM devices d
        JOIN credentials c ON d.device_id = c.device_id
        WHERE c.username LIKE ?
        ORDER BY d.upload_date DESC, d.device_name, c.url
      `,
        [`%${query}%`],
      ) as any[]
    } else if (type === "domain") {
      // Search for domain in file content - look in ALL text files
      searchResults = await executeQuery(
        `
        SELECT 
          d.device_id,
          d.device_name,
          d.upload_batch,
          d.upload_date,
          c.username,
          c.url,
          c.password,
          c.browser,
          c.file_path
        FROM devices d
        JOIN credentials c ON d.device_id = c.device_id
        WHERE c.url LIKE ? OR c.domain LIKE ?
        ORDER BY d.upload_date DESC, d.device_name, c.url
      `,
        [`%${query}%`, `%${query}%`],
      ) as any[]
    } else {
      return NextResponse.json({ error: "Invalid search type" }, { status: 400 })
    }

    console.log(`📊 Raw search results: ${searchResults.length} credential matches`)

    // Group results by device
    const deviceMap = new Map()

    for (const row of searchResults) {
      if (!deviceMap.has(row.device_id)) {
        deviceMap.set(row.device_id, {
          deviceId: row.device_id,
          deviceName: row.device_name,
          uploadBatch: row.upload_batch,
          uploadDate: row.upload_date,
          matchingFiles: [],
          matchedContent: [],
          files: [],
          totalFiles: 0,
          credentials: [], // Add credentials to show what matched
        })
      }

      const device = deviceMap.get(row.device_id)

      // Add matching credential info
      device.credentials.push({
        username: row.username,
        url: row.url,
        password: row.password,
        browser: row.browser,
        filePath: row.file_path,
      })

      // Add file path to matching files if not already there
      if (row.file_path && !device.matchingFiles.includes(row.file_path)) {
        device.matchingFiles.push(row.file_path)
      }

      // Add matched content for display
      const matchedLine = `${row.username} - ${row.url}`
      if (!device.matchedContent.includes(matchedLine)) {
        device.matchedContent.push(matchedLine)
      }
    }

    console.log(`📊 Grouped by devices: ${deviceMap.size} devices found`)

    // Get complete file list and system information for each matching device
    for (const [deviceId, device] of deviceMap) {
      // Get file list
      const allFiles = await executeQuery(
        `
        SELECT file_path, file_name, parent_path, is_directory, file_size, 
               CASE WHEN content IS NOT NULL OR local_file_path IS NOT NULL THEN 1 ELSE 0 END as has_content
        FROM files 
        WHERE device_id = ?
        ORDER BY file_path
      `,
        [deviceId],
      ) as any[]

      device.files = allFiles
      device.totalFiles = (allFiles as any[]).length

      // Get system information from systeminformation table
      const systemInfo = await executeQuery(
        `
        SELECT os, computer_name, ip_address, country, file_path, username
        FROM systeminformation
        WHERE device_id = ?
        LIMIT 1
      `,
        [deviceId],
      ) as any[]

      if (systemInfo.length > 0) {
        const sysInfo = systemInfo[0]
        device.operatingSystem = sysInfo.os || undefined
        device.hostname = sysInfo.computer_name || undefined
        device.ipAddress = sysInfo.ip_address || undefined
        device.country = sysInfo.country || undefined
        device.filePath = sysInfo.file_path || undefined
        device.username = sysInfo.username || undefined
      }
    }

    const results = Array.from(deviceMap.values())

    console.log(`✅ Final search results: ${results.length} devices with matches`)

    return NextResponse.json(results)
  } catch (error) {
    console.error("❌ Search error:", error)
    return NextResponse.json(
      {
        error: "Search failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
