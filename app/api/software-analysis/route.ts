import { NextRequest, NextResponse } from "next/server";
import { executeQuery as executeMySQLQuery } from "@/lib/mysql";
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse";
import { validateRequest } from "@/lib/auth";
import {
  parseDateFilterFromRequest,
  buildDeviceDateFilter,
  buildSystemInfoDateFilter,
} from "@/lib/date-filter-utils";

interface SoftwareData {
  software_name: string;
  version: string | null;
  count: number;
}

export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Parse date filter params
    const searchParams = request.nextUrl.searchParams
    const dateFilter = parseDateFilterFromRequest(searchParams)
    const hasDateFilter = !!(dateFilter.startDate || dateFilter.endDate)

    // Only use cache if no date filter is applied (cache is for "all time" only)
    let cacheResult: any[] = []
    if (!hasDateFilter) {
      // Check cache first (analytics_cache remains in MySQL - operational table)
      cacheResult = (await executeMySQLQuery(
        "SELECT cache_data FROM analytics_cache WHERE cache_key = 'software_analysis' AND expires_at > NOW()"
      )) as any[]
    }

    if (Array.isArray(cacheResult) && cacheResult.length > 0) {
      const cached = cacheResult[0].cache_data
      let parsed: any = null

      try {
        if (typeof cached === "string") {
          parsed = JSON.parse(cached)
        } else if (typeof cached === "object" && cached !== null) {
          parsed = cached
        }
      } catch (_e) {
        console.warn("Software analysis cache parse failed, will recalc")
      }

      if (parsed && parsed.success && parsed.softwareAnalysis) {
        return NextResponse.json(parsed)
      }
    }

    // Build device filter for date range
    let deviceFilter = ""
    if (hasDateFilter) {
      const { whereClause: deviceDateFilter } = buildDeviceDateFilter(dateFilter)
      const { whereClause: systemInfoDateFilter } = buildSystemInfoDateFilter(dateFilter)
      
      // Get device_ids that match date range from both tables
      const deviceIdsFromDevices = await executeClickHouseQuery(`
        SELECT DISTINCT device_id FROM devices ${deviceDateFilter}
      `) as any[]
      
      const deviceIdsFromSystemInfo = await executeClickHouseQuery(`
        SELECT DISTINCT device_id FROM systeminformation ${systemInfoDateFilter}
      `) as any[]
      
      // Combine and deduplicate
      const allDeviceIds = new Set<string>()
      deviceIdsFromDevices.forEach((r: any) => {
        if (r.device_id) allDeviceIds.add(String(r.device_id))
      })
      deviceIdsFromSystemInfo.forEach((r: any) => {
        if (r.device_id) allDeviceIds.add(String(r.device_id))
      })
      
      const deviceIds = Array.from(allDeviceIds)
      
      if (deviceIds.length === 0) {
        // No devices match the date range
        return NextResponse.json({ success: true, softwareAnalysis: [] })
      }
      
      // Use array format for ClickHouse IN clause
      const deviceIdsStr = deviceIds.map(id => `'${id.replace(/'/g, "''")}'`).join(', ')
      deviceFilter = `AND device_id IN (${deviceIdsStr})`
    }

    // Query to get software grouped by name and version for attack surface management
    // ClickHouse: Convert COUNT(DISTINCT device_id) -> uniq(device_id)
    const results = await executeClickHouseQuery(`
      SELECT software_name, version, uniq(device_id) as count
      FROM software 
      WHERE software_name IS NOT NULL AND software_name != '' ${deviceFilter}
      GROUP BY software_name, version
      ORDER BY count DESC, software_name, version
      LIMIT 10
    `) as any[];

    if (!Array.isArray(results)) {
      return NextResponse.json({ success: false, error: "Invalid data format" }, { status: 500 });
    }

    // Convert to array format
    const softwareAnalysis: SoftwareData[] = results.map((row) => ({
      software_name: row.software_name,
      version: row.version,
      count: row.count
    }));

    const result = { 
      success: true, 
      softwareAnalysis 
    };

    // Only cache if no date filter is applied (cache is for "all time" only)
    if (!hasDateFilter) {
      // Cache for 10 minutes
      // analytics_cache remains in MySQL (operational table)
      await executeMySQLQuery(
        "INSERT INTO analytics_cache (cache_key, cache_data, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE)) ON DUPLICATE KEY UPDATE cache_data = VALUES(cache_data), expires_at = VALUES(expires_at)",
        ["software_analysis", JSON.stringify(result)]
      );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error("Software analysis error:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Internal server error" 
    }, { status: 500 });
  }
} 