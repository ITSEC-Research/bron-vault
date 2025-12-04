import { type NextRequest, NextResponse } from "next/server"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"
import { validateRequest } from "@/lib/auth"

/**
 * Build WHERE clause for domain matching that supports subdomains (ClickHouse version)
 * Matches both domain column and hostname extracted from URL
 * Uses named parameters for ClickHouse
 */
function buildDomainWhereClauseClickHouse(targetDomain: string): { whereClause: string; params: Record<string, string> } {
  // Use ilike for case-insensitive matching (data in DB might be mixed case)
  const whereClause = `(
    domain = {domain:String} OR 
    domain ilike concat('%.', {domain:String}) OR
    url ilike {pattern1:String} OR
    url ilike {pattern2:String} OR
    url ilike {pattern3:String} OR
    url ilike {pattern4:String}
  )`
  
  return {
    whereClause,
    params: {
      domain: targetDomain,                              // Exact domain match (uses idx_domain)
      pattern1: `%://${targetDomain}/%`,                   // URL exact: https://api.example.com/
      pattern2: `%://${targetDomain}:%`,                   // URL exact with port: https://api.example.com:8080
      pattern3: `%://%.${targetDomain}/%`,                  // URL subdomain: https://v1.api.example.com/
      pattern4: `%://%.${targetDomain}:%`                   // URL subdomain with port: https://v1.api.example.com:8080
    }
  }
}

export async function POST(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { query, type, page = 1, limit = 50 } = await request.json()

    if (!query || !type) {
      return NextResponse.json({ error: "Query and type are required" }, { status: 400 })
    }

    console.log(`🔍 Searching for: "${query}" by ${type} (page: ${page}, limit: ${limit})`)

    if (type === "email") {
      // Email search: Keep existing logic but add pagination
      // ClickHouse: Use ilike for case-insensitive search
      const pageNum = Number.parseInt(String(page)) || 1
      const limitNum = Number.parseInt(String(limit)) || 50
      const offset = (pageNum - 1) * limitNum
      
      const searchPattern = `%${query}%`
      
      // Get total count first (ClickHouse)
      // Convert: COUNT(DISTINCT device_id) -> uniq(device_id)
      const totalCountResult = await executeClickHouseQuery(
        `
        SELECT uniq(d.device_id) as total
        FROM devices d
        INNER JOIN credentials c ON d.device_id = c.device_id
        WHERE c.username ilike {searchPattern:String}
        `,
        { searchPattern },
      ) as any[]
      
      const total = totalCountResult[0]?.total || 0
      
      // Get devices with pagination (ClickHouse)
      // limitNum and offset are already validated as safe integers
      const devicesResult = await executeClickHouseQuery(
        `
        SELECT DISTINCT d.device_id, d.device_name, d.upload_batch, d.upload_date
        FROM devices d
        INNER JOIN credentials c ON d.device_id = c.device_id
        WHERE c.username ilike {searchPattern:String}
        ORDER BY d.upload_date DESC, d.device_name
        LIMIT ${limitNum} OFFSET ${offset}
        `,
        { searchPattern },
      ) as any[]
      
      // Get file count and system info for each device (ClickHouse)
      const devices = []
      for (const row of devicesResult) {
        const fileCount = await executeClickHouseQuery(
          `SELECT count() as total FROM files WHERE device_id = {deviceId:String}`,
          { deviceId: row.device_id },
        ) as any[]
        
        const systemInfo = await executeClickHouseQuery(
          `SELECT log_date FROM systeminformation WHERE device_id = {deviceId:String} LIMIT 1`,
          { deviceId: row.device_id },
        ) as any[]
        
        devices.push({
          deviceId: row.device_id,
          deviceName: row.device_name,
          uploadBatch: row.upload_batch,
          uploadDate: row.upload_date,
          matchingFiles: [],
          matchedContent: [],
          files: [],
          totalFiles: fileCount[0]?.total || 0,
          credentials: [],
          logDate: systemInfo[0]?.log_date || undefined,
        })
      }
      
      return NextResponse.json({
        devices,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasMore: pageNum * limitNum < total,
        },
      })
      
    } else if (type === "domain") {
      // Domain search: Optimized with EXISTS and pagination
      const pageNum = Math.max(1, Number.parseInt(String(page)) || 1)
      const limitNum = Math.max(1, Math.min(100, Number.parseInt(String(limit)) || 50)) // Limit between 1-100
      const offset = Math.max(0, (pageNum - 1) * limitNum)
      
      // Normalize domain (same as /domain-search)
      let normalizedDomain = query.trim().toLowerCase()
      normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '')
      normalizedDomain = normalizedDomain.replace(/^www\./, '')
      normalizedDomain = normalizedDomain.replace(/\/$/, '')
      normalizedDomain = normalizedDomain.split('/')[0].split(':')[0]
      
      // Build WHERE clause (ClickHouse version with named parameters)
      const { whereClause, params } = buildDomainWhereClauseClickHouse(normalizedDomain)
      
      // Get total count first (ClickHouse)
      // Convert: COUNT(DISTINCT device_id) -> uniq(device_id)
      const totalCountResult = await executeClickHouseQuery(
        `SELECT uniq(device_id) as total
         FROM credentials
         WHERE ${whereClause}`,
        params,
      ) as any[]
      
      const total = totalCountResult[0]?.total || 0
      
      // Get devices with pagination (ClickHouse)
      // ClickHouse doesn't support EXISTS with correlated subqueries like MySQL
      // Use IN subquery instead (more efficient than JOIN for this case)
      // limitNum and offset are already validated as safe integers
      const devicesResult = await executeClickHouseQuery(
        `SELECT DISTINCT d.device_id, d.device_name, d.upload_batch, d.upload_date
         FROM devices d
         WHERE d.device_id IN (
           SELECT DISTINCT device_id
           FROM credentials c
           WHERE ${whereClause}
         )
         ORDER BY d.upload_date DESC, d.device_name
         LIMIT ${limitNum} OFFSET ${offset}`,
        params,
      ) as any[]
      
      console.log(`📊 Found ${devicesResult.length} devices (page ${pageNum}, total: ${total})`)
      
      // Get file count, matching files, and system info for each device (ClickHouse)
      const devices = []
      for (const row of devicesResult) {
        // Get file count
        const fileCount = await executeClickHouseQuery(
          `SELECT count() as total FROM files WHERE device_id = {deviceId:String}`,
          { deviceId: row.device_id },
        ) as any[]
        
        // Get matching file paths (files that contain matching credentials)
        // Merge params: device_id + whereClause params
        const matchingFilesParams = { ...params, deviceId: row.device_id }
        const matchingFilesResult = await executeClickHouseQuery(
          `SELECT DISTINCT file_path
           FROM credentials
           WHERE device_id = {deviceId:String} AND ${whereClause} AND file_path IS NOT NULL`,
          matchingFilesParams,
        ) as any[]
        
        const matchingFiles = matchingFilesResult.map((f: any) => f.file_path).filter(Boolean)
        
        // Get system info
        const systemInfo = await executeClickHouseQuery(
          `SELECT log_date FROM systeminformation WHERE device_id = {deviceId:String} LIMIT 1`,
          { deviceId: row.device_id },
        ) as any[]
        
        devices.push({
          deviceId: row.device_id,
          deviceName: row.device_name,
          uploadBatch: row.upload_batch,
          uploadDate: row.upload_date,
          matchingFiles,
          matchedContent: [], // Will be populated when device is clicked (lazy loading)
          files: [],
          totalFiles: fileCount[0]?.total || 0,
          credentials: [], // Will be loaded when device is clicked (lazy loading)
          logDate: systemInfo[0]?.log_date || undefined,
        })
      }
      
      return NextResponse.json({
        devices,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasMore: pageNum * limitNum < total,
        },
      })
    } else {
      return NextResponse.json({ error: "Invalid search type" }, { status: 400 })
    }
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
