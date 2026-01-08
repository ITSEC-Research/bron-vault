import { NextRequest, NextResponse } from "next/server"
import { executeQuery as executeMySQLQuery } from "@/lib/mysql"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"
import { validateRequest } from "@/lib/auth"

export async function GET(request: NextRequest) {
  console.log("🔍 [TOP-TLDS] API called")

  // Validate authentication
  const user = await validateRequest(request)
  console.log("🔍 [TOP-TLDS] Auth validation result:", user ? "SUCCESS" : "FAILED")

  if (!user) {
    console.log("❌ [TOP-TLDS] Unauthorized - no valid user found")
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("📊 [TOP-TLDS] Loading top TLDs for user:", (user as any).username || "<unknown>")

    // Check cache first (analytics_cache tetap di MySQL - operational table)
    console.log("📊 [TOP-TLDS] Checking cache...")
    const cacheResult = (await executeMySQLQuery(
      "SELECT cache_data FROM analytics_cache WHERE cache_key = 'top_tlds' AND expires_at > NOW()",
    )) as any[]

    console.log("📊 [TOP-TLDS] Cache result length:", Array.isArray(cacheResult) ? cacheResult.length : "unexpected")

    if (cacheResult.length > 0) {
      console.log("📊 [TOP-TLDS] Using cached top TLDs")
      const cachedDataRaw = cacheResult[0].cache_data
      let cachedData: any = null

      try {
        if (typeof cachedDataRaw === "string") {
          cachedData = JSON.parse(cachedDataRaw)
        } else if (typeof cachedDataRaw === "object" && cachedDataRaw !== null) {
          // Already an object (possibly due to previous bad write), use as-is
          cachedData = cachedDataRaw
        } else {
          throw new Error("Unsupported cache_data type")
        }
      } catch (e) {
        console.warn("📊 [TOP-TLDS] Failed to parse cached data, ignoring cache:", e)
        cachedData = null
      }

      if (cachedData) {
        console.log(
          "📊 [TOP-TLDS] Cached data length:",
          Array.isArray(cachedData) ? cachedData.length : "unknown",
        )
        return NextResponse.json(cachedData)
      } else {
        console.log("📊 [TOP-TLDS] Cache corrupted or invalid, will recalc")
      }
    }

    console.log("📊 [TOP-TLDS] Calculating fresh top TLDs...")

    // Get top TLDs from credentials table (ClickHouse)
    // Convert: COUNT(DISTINCT device_id) -> uniq(device_id) untuk performa lebih baik
    const topTlds = await executeClickHouseQuery(`
      SELECT 
        tld,
        count() as count,
        uniq(device_id) as affected_devices
      FROM credentials 
      WHERE tld IS NOT NULL 
        AND tld != ''
        AND tld NOT LIKE '%localhost%'
        AND tld NOT LIKE '%127.0.0.1%'
        AND tld NOT LIKE '%192.168%'
        AND tld NOT LIKE '%10.%'
      GROUP BY tld 
      ORDER BY count DESC, affected_devices DESC
      LIMIT 10
    `)

    console.log(
      `📊 [TOP-TLDS] Found ${Array.isArray(topTlds) ? (topTlds as any[]).length : "?"} top TLDs`,
    )
    console.log("📊 [TOP-TLDS] Sample data:", Array.isArray(topTlds) ? (topTlds as any[]).slice(0, 2) : topTlds)

    // Serialize for cache (safe fallback)
    let serialized: string
    try {
      serialized = JSON.stringify(topTlds)
    } catch (e) {
      console.error("📊 [TOP-TLDS] Failed to serialize topTlds for cache:", e)
      serialized = "[]" // fallback empty array
    }

    // Cache for 10 minutes (upsert)
    // analytics_cache tetap di MySQL (operational table)
    console.log("📊 [TOP-TLDS] Caching results...")
    await executeMySQLQuery(
      `
      INSERT INTO analytics_cache (cache_key, cache_data, expires_at)
      VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))
      ON DUPLICATE KEY UPDATE cache_data = VALUES(cache_data), expires_at = VALUES(expires_at)
      `,
      ["top_tlds", serialized],
    )

    console.log("📊 [TOP-TLDS] Returning fresh data")
    return NextResponse.json(topTlds)
  } catch (error) {
    console.error("❌ [TOP-TLDS] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to get top TLDs",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
