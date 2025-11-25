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
      // Search for email in credentials table - use username index
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
        LIMIT 1000
      `,
        [`%${query}%`],
      ) as any[]
    } else if (type === "domain") {
      // Optimized search: Use domain index first, then URL LIKE as fallback
      // Extract hostname from URL for better matching
      const hostnameExpr = `CASE 
        WHEN c.url LIKE 'http://%' OR c.url LIKE 'https://%' THEN
          LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(REPLACE(c.url, 'http://', ''), 'https://', ''), '/', 1), ':', 1))
        ELSE
          LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(c.url, '/', 1), ':', 1))
      END`
      
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
        WHERE 
          c.domain LIKE ? OR 
          c.domain = ? OR
          ${hostnameExpr} LIKE ? OR
          c.url LIKE ?
        ORDER BY d.upload_date DESC, d.device_name, c.url
        LIMIT 1000
      `,
        [`%${query}%`, query, `%${query}%`, `%${query}%`],
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

    // OPTIMIZATION: Only get total file count and system info (log_date) for each device
    // Don't load all files - that will be loaded lazily when device is clicked
    for (const [deviceId, device] of deviceMap) {
      // Get only file count (much faster than loading all files)
      const fileCount = await executeQuery(
        `
        SELECT COUNT(*) as total FROM files WHERE device_id = ?
      `,
        [deviceId],
      ) as any[]

      device.totalFiles = fileCount[0]?.total || 0
      device.files = [] // Empty array - will be loaded when device is clicked

      // Get only system information (specifically log_date) - lightweight query
      const systemInfo = await executeQuery(
        `
        SELECT log_date
        FROM systeminformation
        WHERE device_id = ?
        LIMIT 1
      `,
        [deviceId],
      ) as any[]

      if (systemInfo.length > 0) {
        device.logDate = systemInfo[0].log_date || undefined
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
