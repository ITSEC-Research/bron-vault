import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { logInfo, logError } from "@/lib/logger"
import { validateRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }
  try {
    console.log("📊 Loading stats...")

    // Check cache first
    const cacheResult = (await executeQuery(
      "SELECT cache_data FROM analytics_cache WHERE cache_key = 'stats_main' AND expires_at > NOW()",
    )) as any[]

    if (cacheResult.length > 0) {
      console.log("📊 Using cached stats")
      return NextResponse.json(cacheResult[0].cache_data)
    }

    console.log("📊 Calculating fresh stats...")

    // Get basic stats
    const deviceCount = await executeQuery("SELECT COUNT(*) as count FROM devices")
    const totalDevices = (deviceCount as any[])[0].count
    console.log(`📊 Total devices: ${totalDevices}`)

    const uniqueNames = await executeQuery("SELECT COUNT(DISTINCT device_name_hash) as count FROM devices")
    const uniqueDeviceNames = (uniqueNames as any[])[0].count
    console.log(`📊 Unique device names: ${uniqueDeviceNames}`)

    const duplicateNames = await executeQuery(`
      SELECT COUNT(*) as count 
      FROM (
        SELECT device_name_hash 
        FROM devices 
        GROUP BY device_name_hash 
        HAVING COUNT(*) > 1
      ) as duplicates
    `)
    const duplicateDeviceNames = (duplicateNames as any[])[0].count
    console.log(`📊 Duplicate device names: ${duplicateDeviceNames}`)

    const fileCount = await executeQuery("SELECT COUNT(*) as count FROM files WHERE is_directory = FALSE")
    const totalFiles = (fileCount as any[])[0].count
    console.log(`📊 Total files: ${totalFiles}`)

    // Get aggregated stats from devices table
    const aggregatedStats = await executeQuery(`
      SELECT 
        SUM(total_credentials) as total_credentials,
        SUM(total_domains) as total_domains,
        SUM(total_urls) as total_urls
      FROM devices
    `)
    const aggStats = (aggregatedStats as any[])[0]
    console.log(`📊 Aggregated stats:`, aggStats)

    // Get top 5 passwords based on unique device count that uses that password
    const topPasswords = await executeQuery(`
      SELECT password, COUNT(DISTINCT device_id) as total_count
      FROM (
        SELECT DISTINCT device_id, password
        FROM password_stats
        WHERE password IS NOT NULL 
          AND password != ''
          AND password != ' '
          AND TRIM(password) != ''
          AND LENGTH(TRIM(password)) > 0
          AND password NOT LIKE '%null%'
          AND password NOT LIKE '%undefined%'
          AND password NOT LIKE '%N/A%'
          AND password NOT LIKE '%n/a%'
          AND password NOT LIKE '%none%'
          AND password NOT LIKE '%None%'
          AND password NOT LIKE '%NONE%'
          AND password NOT LIKE '%blank%'
          AND password NOT LIKE '%Blank%'
          AND password NOT LIKE '%BLANK%'
          AND password NOT LIKE '%empty%'
          AND password NOT LIKE '%Empty%'
          AND password NOT LIKE '%EMPTY%'
          AND password != '[NOT_SAVED]'
          AND password NOT LIKE '%[NOT_SAVED]%'
          AND password NOT REGEXP '^[[:space:]]*$'
      ) as unique_passwords
      GROUP BY password
      ORDER BY total_count DESC, password ASC
      LIMIT 5
    `)
    const topPasswordsArray = topPasswords as any[]
    logInfo(`Top passwords: ${topPasswordsArray.length} found`, undefined, 'Stats API')

    // Get recent devices
    const recentDevices = await executeQuery(`
      SELECT device_id, device_name, upload_batch, upload_date, total_files, total_credentials, total_domains, total_urls
      FROM devices 
      ORDER BY upload_date DESC 
      LIMIT 10
    `)

    // Get upload batch stats
    const batchStats = await executeQuery(`
      SELECT 
        upload_batch,
        COUNT(*) as devices_count,
        SUM(total_credentials) as batch_credentials,
        SUM(total_domains) as batch_domains,
        SUM(total_urls) as batch_urls,
        MAX(upload_date) as upload_date
      FROM devices 
      GROUP BY upload_batch 
      ORDER BY upload_date DESC 
      LIMIT 10
    `)

    const result = {
      stats: {
        totalDevices,
        uniqueDeviceNames,
        duplicateDeviceNames,
        totalFiles,
        totalCredentials: Number(aggStats.total_credentials) || 0,
        totalDomains: Number(aggStats.total_domains) || 0,
        totalUrls: Number(aggStats.total_urls) || 0,
      },
      topPasswords,
      devices: recentDevices,
      batches: batchStats,
    }

    logInfo(`Final stats result`, result.stats, 'Stats API')

    // Cache for 5 minutes
    await executeQuery(
      "INSERT INTO analytics_cache (cache_key, cache_data, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE)) ON DUPLICATE KEY UPDATE cache_data = VALUES(cache_data), expires_at = VALUES(expires_at)",
      ["stats_main", JSON.stringify(result)],
    )

    return NextResponse.json(result)
  } catch (error) {
    logError("Stats error", error, 'Stats API')
    return NextResponse.json(
      {
        error: "Failed to get stats",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
