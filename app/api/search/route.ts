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
      // SECURITY: Validate and sanitize pagination parameters
      const pageNum = Math.max(1, Math.floor(Number(page)) || 1)
      const limitNum = Math.min(1000, Math.max(1, Math.floor(Number(limit)) || 50))
      const offset = Math.max(0, (pageNum - 1) * limitNum)
      
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
      // SECURITY: Use parameterized LIMIT/OFFSET
      const devicesResult = await executeClickHouseQuery(
        `
        SELECT DISTINCT d.device_id, d.device_name, d.upload_batch, d.upload_date
        FROM devices d
        INNER JOIN credentials c ON d.device_id = c.device_id
        WHERE c.username ilike {searchPattern:String}
        ORDER BY d.upload_date DESC, d.device_name
        LIMIT {limitNum:UInt32} OFFSET {offset:UInt32}
        `,
        { searchPattern, limitNum, offset },
      ) as any[]
      
      // OPTIMIZED: Get file count and system info in batch queries instead of N+1
      // Extract all device IDs for batch query
      const deviceIds = devicesResult.map(r => r.device_id)
      
      // Batch query for file counts
      const fileCountsResult = deviceIds.length > 0 ? await executeClickHouseQuery(
        `SELECT device_id, count() as total 
         FROM files 
         WHERE device_id IN ({deviceIds:Array(String)})
         GROUP BY device_id`,
        { deviceIds },
      ) as any[] : []
      
      // Batch query for system info
      const systemInfoResult = deviceIds.length > 0 ? await executeClickHouseQuery(
        `SELECT device_id, log_date 
         FROM systeminformation 
         WHERE device_id IN ({deviceIds:Array(String)})`,
        { deviceIds },
      ) as any[] : []
      
      // Create lookup maps for O(1) access
      const fileCountMap = new Map<string, number>()
      for (const row of fileCountsResult) {
        fileCountMap.set(row.device_id, Number(row.total) || 0)
      }
      
      const systemInfoMap = new Map<string, string>()
      for (const row of systemInfoResult) {
        if (!systemInfoMap.has(row.device_id)) {
          systemInfoMap.set(row.device_id, row.log_date)
        }
      }
      
      // Build response using lookup maps
      const devices = devicesResult.map((row: any) => ({
        deviceId: row.device_id,
        deviceName: row.device_name,
        uploadBatch: row.upload_batch,
        uploadDate: row.upload_date,
        matchingFiles: [],
        matchedContent: [],
        files: [],
        totalFiles: fileCountMap.get(row.device_id) || 0,
        credentials: [],
        logDate: systemInfoMap.get(row.device_id) || undefined,
      }))
      
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
      // SECURITY: Use parameterized LIMIT/OFFSET
      const devicesResult = await executeClickHouseQuery(
        `SELECT DISTINCT d.device_id, d.device_name, d.upload_batch, d.upload_date
         FROM devices d
         WHERE d.device_id IN (
           SELECT DISTINCT device_id
           FROM credentials c
           WHERE ${whereClause}
         )
         ORDER BY d.upload_date DESC, d.device_name
         LIMIT {limitNum:UInt32} OFFSET {offset:UInt32}`,
        { ...params, limitNum, offset },
      ) as any[]
      
      console.log(`📊 Found ${devicesResult.length} devices (page ${pageNum}, total: ${total})`)
      
      // OPTIMIZED: Batch queries to avoid N+1 pattern
      const deviceIds = devicesResult.map((r: any) => r.device_id)
      
      // Batch query: Get file counts for all devices at once
      const fileCountsResult = deviceIds.length > 0 ? await executeClickHouseQuery(
        `SELECT device_id, count() as total FROM files WHERE device_id IN ({deviceIds:Array(String)}) GROUP BY device_id`,
        { deviceIds },
      ) as any[] : []
      const fileCountsMap = new Map(fileCountsResult.map((r: any) => [r.device_id, r.total]))
      
      // Batch query: Get matching files for all devices at once
      const matchingFilesResult = deviceIds.length > 0 ? await executeClickHouseQuery(
        `SELECT device_id, file_path
         FROM credentials
         WHERE device_id IN ({deviceIds:Array(String)}) AND ${whereClause} AND file_path IS NOT NULL`,
        { ...params, deviceIds },
      ) as any[] : []
      const matchingFilesMap = new Map<string, string[]>()
      for (const row of matchingFilesResult) {
        const files = matchingFilesMap.get(row.device_id) || []
        if (row.file_path && !files.includes(row.file_path)) {
          files.push(row.file_path)
        }
        matchingFilesMap.set(row.device_id, files)
      }
      
      // Batch query: Get system info for all devices at once
      const systemInfoResult = deviceIds.length > 0 ? await executeClickHouseQuery(
        `SELECT device_id, log_date FROM systeminformation WHERE device_id IN ({deviceIds:Array(String)})`,
        { deviceIds },
      ) as any[] : []
      const systemInfoMap = new Map(systemInfoResult.map((r: any) => [r.device_id, r.log_date]))
      
      // Build devices array using Maps for O(1) lookups
      const devices = devicesResult.map((row: any) => ({
        deviceId: row.device_id,
        deviceName: row.device_name,
        uploadBatch: row.upload_batch,
        uploadDate: row.upload_date,
        matchingFiles: matchingFilesMap.get(row.device_id) || [],
        matchedContent: [], // Will be populated when device is clicked (lazy loading)
        files: [],
        totalFiles: fileCountsMap.get(row.device_id) || 0,
        credentials: [], // Will be loaded when device is clicked (lazy loading)
        logDate: systemInfoMap.get(row.device_id) || undefined,
      }))
      
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
