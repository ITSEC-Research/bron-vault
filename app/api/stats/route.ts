import { NextRequest, NextResponse } from "next/server"
import { executeQuery, ensurePerformanceIndexes } from "@/lib/mysql"
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

    // Check cache first (indexes are ensured during database initialization, not here)
    const cacheResult = (await executeQuery(
      "SELECT cache_data FROM analytics_cache WHERE cache_key = 'stats_main' AND expires_at > NOW()",
    )) as any[]

    if (cacheResult.length > 0) {
      console.log("📊 Using cached stats")
      let cached = cacheResult[0].cache_data
      let parsed: any = null

      try {
        if (typeof cached === "string") {
          parsed = JSON.parse(cached)
        } else if (typeof cached === "object" && cached !== null) {
          parsed = cached
        } else {
          throw new Error("Unsupported cached format")
        }
      } catch (e) {
        console.warn("📊 Cached stats parse failed, will recalc. Error:", e)
        parsed = null
      }

      if (parsed) {
        return NextResponse.json(parsed)
      } else {
        console.log("📊 Cache corrupted or invalid, continuing to recompute stats")
      }
    }

    console.log("📊 Calculating fresh stats...")

    // Run all queries in parallel for maximum speed
    const [
      deviceCountResult,
      uniqueNamesResult,
      fileCountResult,
      aggregatedStatsResult,
      topPasswordsResult,
      recentDevicesResult,
      batchStatsResult
    ] = await Promise.all([
      executeQuery("SELECT COUNT(*) as count FROM devices"),
      executeQuery("SELECT COUNT(DISTINCT device_name_hash) as count FROM devices"),
      executeQuery("SELECT COUNT(*) as count FROM files WHERE is_directory = FALSE"),
      executeQuery(`
        SELECT 
          SUM(total_credentials) as total_credentials,
          SUM(total_domains) as total_domains,
          SUM(total_urls) as total_urls
        FROM devices
      `),
      // Optimized: Remove nested subquery and simplify filters - use NOT IN for exact matches
      executeQuery(`
        SELECT password, COUNT(DISTINCT device_id) as total_count
        FROM password_stats
        WHERE password IS NOT NULL 
          AND LENGTH(TRIM(password)) > 2
          AND password NOT IN ('', ' ', 'null', 'undefined', 'N/A', 'n/a', 'none', 'None', 'NONE', 'blank', 'Blank', 'BLANK', 'empty', 'Empty', 'EMPTY', '[NOT_SAVED]')
          AND password NOT LIKE '%[NOT_SAVED]%'
          AND TRIM(password) REGEXP '^[^[:space:]]+$'
        GROUP BY password
        ORDER BY total_count DESC, password ASC
        LIMIT 5
      `),
      executeQuery(`
        SELECT device_id, device_name, upload_batch, upload_date, total_files, total_credentials, total_domains, total_urls
        FROM devices 
        ORDER BY upload_date DESC 
        LIMIT 10
      `),
      executeQuery(`
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
    ])

    const totalDevices = (deviceCountResult as any[])[0].count
    console.log(`📊 Total devices: ${totalDevices}`)

    const uniqueDeviceNames = (uniqueNamesResult as any[])[0].count
    console.log(`📊 Unique device names: ${uniqueDeviceNames}`)

    // Calculate duplicates: total - unique (much faster than subquery)
    const duplicateDeviceNames = totalDevices - uniqueDeviceNames
    console.log(`📊 Duplicate device names: ${duplicateDeviceNames}`)

    const totalFiles = (fileCountResult as any[])[0].count
    console.log(`📊 Total files: ${totalFiles}`)

    const aggStats = (aggregatedStatsResult as any[])[0]
    console.log(`📊 Aggregated stats:`, aggStats)

    const topPasswordsArray = topPasswordsResult as any[]
    logInfo(`Top passwords: ${topPasswordsArray.length} found`, undefined, 'Stats API')

    const recentDevices = recentDevicesResult as any[]
    const batchStats = batchStatsResult as any[]

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
      topPasswords: topPasswordsArray,
      devices: recentDevices,
      batches: batchStats,
    }

    logInfo(`Final stats result`, result.stats, 'Stats API')

    // Cache for 30 minutes (longer cache for better performance)
    await executeQuery(
      "INSERT INTO analytics_cache (cache_key, cache_data, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE)) ON DUPLICATE KEY UPDATE cache_data = VALUES(cache_data), expires_at = VALUES(expires_at)",
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
