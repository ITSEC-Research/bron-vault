import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
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
    console.log("📊 [TOP-TLDS] Loading top TLDs for user:", user.username)

    // Check cache first
    console.log("📊 [TOP-TLDS] Checking cache...")
    const cacheResult = (await executeQuery(
      "SELECT cache_data FROM analytics_cache WHERE cache_key = 'top_tlds' AND expires_at > NOW()",
    )) as any[]

    console.log("📊 [TOP-TLDS] Cache result length:", cacheResult.length)

    if (cacheResult.length > 0) {
      console.log("📊 [TOP-TLDS] Using cached top TLDs")
      const cachedData = JSON.parse(cacheResult[0].cache_data)
      console.log("📊 [TOP-TLDS] Cached data length:", cachedData.length)
      return NextResponse.json(cachedData)
    }

    console.log("📊 [TOP-TLDS] Calculating fresh top TLDs...")

    // Get top TLDs from credentials table
    const topTlds = await executeQuery(`
      SELECT 
        tld,
        COUNT(*) as count,
        COUNT(DISTINCT device_id) as affected_devices
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

    console.log(`📊 [TOP-TLDS] Found ${(topTlds as any[]).length} top TLDs`)
    console.log("📊 [TOP-TLDS] Sample data:", (topTlds as any[]).slice(0, 2))

    // Cache for 10 minutes
    console.log("📊 [TOP-TLDS] Caching results...")
    await executeQuery(
      "INSERT INTO analytics_cache (cache_key, cache_data, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE)) ON DUPLICATE KEY UPDATE cache_data = VALUES(cache_data), expires_at = VALUES(expires_at)",
      ["top_tlds", JSON.stringify(topTlds)],
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
