import { NextRequest, NextResponse } from "next/server"
import { executeQuery as executeMySQLQuery } from "@/lib/mysql"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"
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

    // Check cache first (analytics_cache remains in MySQL - operational table)
    const cacheResult = (await executeMySQLQuery(
      "SELECT cache_data FROM analytics_cache WHERE cache_key = 'stats_main' AND expires_at > NOW()",
    )) as any[]

    if (cacheResult.length > 0) {
      console.log("📊 Using cached stats")
      const cached = cacheResult[0].cache_data
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

      // VALIDATION: Ensure cached data has correct structure
      // If totalDevices or totalFiles is missing, null, or not a number, recalculate
      if (parsed && parsed.stats) {
        const hasValidData = 
          parsed.stats.totalDevices !== undefined && 
          parsed.stats.totalDevices !== null &&
          typeof parsed.stats.totalDevices === 'number' &&
          parsed.stats.totalFiles !== undefined && 
          parsed.stats.totalFiles !== null &&
          typeof parsed.stats.totalFiles === 'number'
        
        if (hasValidData) {
          console.log("📊 Cache valid, returning cached data")
          console.log(`📊 Cached stats - Total devices: ${parsed.stats.totalDevices}, Total files: ${parsed.stats.totalFiles}`)
        return NextResponse.json(parsed)
        } else {
          console.log("📊 Cache data incomplete or invalid (missing/invalid totalDevices or totalFiles), recalculating...")
          console.log("📊 Cache stats structure:", JSON.stringify(parsed.stats))
          // Invalidate cache by deleting it
          await executeMySQLQuery(
            "DELETE FROM analytics_cache WHERE cache_key = 'stats_main'"
          )
        }
      } else {
        console.log("📊 Cache corrupted or invalid structure, continuing to recompute stats")
      }
    }

    console.log("📊 Calculating fresh stats...")

    // Run all queries in parallel for maximum speed
    // NOTE: All queries to ClickHouse except analytics_cache (remains MySQL)
    // OPTIMIZED: Combine device queries to reduce network round-trips
    let deviceStatsResult: any[]
    let fileCountResult: any[]
    let aggregatedStatsResult: any[]
    let topPasswordsResult: any[]
    let recentDevicesResult: any[]
    let batchStatsResult: any[]

    try {
      [
        deviceStatsResult,
      fileCountResult,
      aggregatedStatsResult,
      topPasswordsResult,
      recentDevicesResult,
      batchStatsResult
    ] = await Promise.all([
        // ClickHouse: Combine device queries (count + uniq) for optimization
        executeClickHouseQuery(`
          SELECT 
            count() as total_devices,
            uniq(device_name_hash) as unique_devices
          FROM devices
        `),
        // ClickHouse: COUNT with WHERE
        executeClickHouseQuery("SELECT count() as count FROM files WHERE is_directory = 0"),
        // ClickHouse: SUM aggregations
        executeClickHouseQuery(`
        SELECT 
            sum(total_credentials) as total_credentials,
            sum(total_domains) as total_domains,
            sum(total_urls) as total_urls
        FROM devices
      `),
        // ClickHouse: Top passwords query
        // Convert: LENGTH(TRIM(password)) -> length(trimBoth(password))
        // Convert: TRIM(password) REGEXP -> match(trimBoth(password), ...)
        // Convert: COUNT(DISTINCT device_id) -> uniq(device_id)
        executeClickHouseQuery(`
          SELECT password, uniq(device_id) as total_count
        FROM password_stats
        WHERE password IS NOT NULL 
            AND length(trimBoth(password)) > 2
          AND password NOT IN ('', ' ', 'null', 'undefined', 'N/A', 'n/a', 'none', 'None', 'NONE', 'blank', 'Blank', 'BLANK', 'empty', 'Empty', 'EMPTY', '[NOT_SAVED]')
          AND password NOT LIKE '%[NOT_SAVED]%'
            AND match(trimBoth(password), '^[^[:space:]]+$')
        GROUP BY password
        ORDER BY total_count DESC, password ASC
        LIMIT 5
      `),
        // ClickHouse: Recent devices
        executeClickHouseQuery(`
        SELECT device_id, device_name, upload_batch, upload_date, total_files, total_credentials, total_domains, total_urls
        FROM devices 
        ORDER BY upload_date DESC 
        LIMIT 10
      `),
        // ClickHouse: Batch stats
        executeClickHouseQuery(`
        SELECT 
          upload_batch,
            count() as devices_count,
            sum(total_credentials) as batch_credentials,
            sum(total_domains) as batch_domains,
            sum(total_urls) as batch_urls,
            max(upload_date) as upload_date
        FROM devices 
        GROUP BY upload_batch 
        ORDER BY upload_date DESC 
        LIMIT 10
      `)
    ])

      // Debug: Log raw results for troubleshooting
      console.log("🔍 DEBUG: deviceStatsResult:", JSON.stringify(deviceStatsResult))
      console.log("🔍 DEBUG: fileCountResult:", JSON.stringify(fileCountResult))
      console.log("🔍 DEBUG: aggregatedStatsResult:", JSON.stringify(aggregatedStatsResult))
    } catch (error) {
      console.error("❌ Error executing ClickHouse queries:", error)
      console.error("❌ Error details:", error instanceof Error ? error.message : String(error))
      console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack trace")
      throw error
    }

    // Extract from optimized query result with SAFETY CHECK & NUMBER CASTING
    // IMPORTANT: ClickHouse count() and uniq() return UInt64 (String in JSON), must cast to Number
    console.log("🔍 DEBUG: deviceStatsResult type:", typeof deviceStatsResult, Array.isArray(deviceStatsResult))
    console.log("🔍 DEBUG: deviceStatsResult length:", deviceStatsResult?.length)
    
    if (!Array.isArray(deviceStatsResult) || deviceStatsResult.length === 0) {
      console.error("❌ ERROR: deviceStatsResult is not a valid array or is empty")
      throw new Error("Invalid deviceStatsResult from ClickHouse")
    }

    const deviceStats = deviceStatsResult[0] || {}
    console.log("🔍 DEBUG: deviceStats object:", JSON.stringify(deviceStats))
    console.log("🔍 DEBUG: deviceStats keys:", Object.keys(deviceStats))
    console.log("🔍 DEBUG: deviceStats.total_devices raw:", deviceStats.total_devices, typeof deviceStats.total_devices)
    console.log("🔍 DEBUG: deviceStats.unique_devices raw:", deviceStats.unique_devices, typeof deviceStats.unique_devices)
    
    const totalDevices = Number(deviceStats.total_devices) || 0
    const uniqueDeviceNames = Number(deviceStats.unique_devices) || 0
    
    console.log(`📊 Total devices: ${totalDevices}`)
    console.log(`📊 Unique device names: ${uniqueDeviceNames}`)

    // Calculate duplicates: total - unique (much faster than subquery)
    // IMPORTANT: Ensure both values are Number before subtraction
    const duplicateDeviceNames = Math.max(0, totalDevices - uniqueDeviceNames)
    console.log(`📊 Duplicate device names: ${duplicateDeviceNames}`)

    // IMPORTANT: Cast file count as well (ClickHouse returns String)
    console.log("🔍 DEBUG: fileCountResult type:", typeof fileCountResult, Array.isArray(fileCountResult))
    console.log("🔍 DEBUG: fileCountResult length:", fileCountResult?.length)
    
    if (!Array.isArray(fileCountResult) || fileCountResult.length === 0) {
      console.error("❌ ERROR: fileCountResult is not a valid array or is empty")
      throw new Error("Invalid fileCountResult from ClickHouse")
    }

    const fileStats = fileCountResult[0] || {}
    console.log("🔍 DEBUG: fileStats object:", JSON.stringify(fileStats))
    console.log("🔍 DEBUG: fileStats.count raw:", fileStats.count, typeof fileStats.count)
    
    const totalFiles = Number(fileStats.count) || 0
    console.log(`📊 Total files: ${totalFiles}`)

    // IMPORTANT: Cast aggregated stats as well
    const aggStats = (aggregatedStatsResult as any[])[0] || {}
    console.log(`📊 Aggregated stats:`, aggStats)

    // IMPORTANT: Cast topPasswords total_count to Number (ClickHouse uniq() returns String)
    const topPasswordsArray = (topPasswordsResult as any[]).map((pw: any) => ({
      ...pw,
      total_count: Number(pw.total_count) || 0,
    }))
    logInfo(`Top passwords: ${topPasswordsArray.length} found`, undefined, 'Stats API')

    const recentDevices = recentDevicesResult as any[]
    
    // IMPORTANT: Cast batch stats as well (count() returns String)
    const batchStats = (batchStatsResult as any[]).map((batch: any) => ({
      ...batch,
      devices_count: Number(batch.devices_count) || 0,
      batch_credentials: Number(batch.batch_credentials) || 0,
      batch_domains: Number(batch.batch_domains) || 0,
      batch_urls: Number(batch.batch_urls) || 0,
    }))

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
    // analytics_cache remains in MySQL (operational table)
    await executeMySQLQuery(
      "INSERT INTO analytics_cache (cache_key, cache_data, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE)) ON DUPLICATE KEY UPDATE cache_data = VALUES(cache_data), expires_at = VALUES(expires_at)",
      ["stats_main", JSON.stringify(result)],
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error("❌ Stats API Error:", error)
    console.error("❌ Error type:", typeof error)
    console.error("❌ Error message:", error instanceof Error ? error.message : String(error))
    console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack trace")
    
    logError("Stats error", error, 'Stats API')
    
    // Return detailed error for debugging
    return NextResponse.json(
      {
        error: "Failed to get stats",
        details: error instanceof Error ? error.message : "Unknown error",
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      },
      { status: 500 },
    )
  }
}
