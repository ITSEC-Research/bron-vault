import { NextRequest, NextResponse } from "next/server";
import { pool, executeQuery } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2";
import { validateRequest } from "@/lib/auth";

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
    // Check cache first
    const cacheResult = (await executeQuery(
      "SELECT cache_data FROM analytics_cache WHERE cache_key = 'software_analysis' AND expires_at > NOW()"
    )) as any[]

    if (Array.isArray(cacheResult) && cacheResult.length > 0) {
      const cached = cacheResult[0].cache_data
      let parsed: any = null

      try {
        if (typeof cached === "string") {
          parsed = JSON.parse(cached)
        } else if (typeof cached === "object" && cached !== null) {
          parsed = cached
        }
      } catch (e) {
        console.warn("Software analysis cache parse failed, will recalc")
      }

      if (parsed && parsed.success && parsed.softwareAnalysis) {
        return NextResponse.json(parsed)
      }
    }

    // Query to get software grouped by name and version for attack surface management
    const [results] = await pool.query<RowDataPacket[]>(`
      SELECT software_name, version, COUNT(DISTINCT device_id) as count
      FROM software 
      WHERE software_name IS NOT NULL AND software_name != ''
      GROUP BY software_name, version
      ORDER BY count DESC, software_name, version
      LIMIT 10
    `);

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

    // Cache for 10 minutes
    await executeQuery(
      "INSERT INTO analytics_cache (cache_key, cache_data, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE)) ON DUPLICATE KEY UPDATE cache_data = VALUES(cache_data), expires_at = VALUES(expires_at)",
      ["software_analysis", JSON.stringify(result)]
    );

    return NextResponse.json(result);

  } catch (error) {
    console.error("Software analysis error:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Internal server error" 
    }, { status: 500 });
  }
} 