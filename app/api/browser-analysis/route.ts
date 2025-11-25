import { NextRequest, NextResponse } from "next/server";
import { pool, executeQuery } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2";
import { validateRequest } from "@/lib/auth";

interface BrowserData {
  browser: string;
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
      "SELECT cache_data FROM analytics_cache WHERE cache_key = 'browser_analysis' AND expires_at > NOW()"
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
        console.warn("Browser analysis cache parse failed, will recalc")
      }

      if (parsed && parsed.success && parsed.browserAnalysis) {
        return NextResponse.json(parsed)
      }
    }

    // Optimized query: Get unique browsers per device_id directly with COUNT
    // This processes much less data than fetching all rows
    const [results] = await pool.query<RowDataPacket[]>(`
      SELECT 
        browser,
        COUNT(DISTINCT device_id) as device_count
      FROM credentials 
      WHERE browser IS NOT NULL AND browser != ''
      GROUP BY browser
    `);

    if (!Array.isArray(results)) {
      return NextResponse.json({ success: false, error: "Invalid data format" }, { status: 500 });
    }

    // Process and normalize browser names
    const browserCounts: { [key: string]: number } = {};
    
    results.forEach((row) => {
      const originalBrowser = row.browser;
      if (!originalBrowser) return;

      // Normalize browser name
      let normalizedBrowser = originalBrowser
        .toLowerCase()
        .replace(/\s*\([^)]*\)/g, '') // Remove version info in parentheses
        .replace(/\s*profile\s*\d*/gi, '') // Remove "Profile X"
        .replace(/\s*default/gi, '') // Remove "Default"
        .replace(/\s*\([^)]*\)/g, '') // Remove any remaining parentheses content
        .trim();

      // Map common browser names
      if (normalizedBrowser.includes('chrome') && !normalizedBrowser.includes('chromium')) {
        normalizedBrowser = 'Google Chrome';
      } else if (normalizedBrowser.includes('edge') || normalizedBrowser.includes('microsoft')) {
        normalizedBrowser = 'Microsoft Edge';
      } else if (normalizedBrowser.includes('firefox') || normalizedBrowser.includes('mozilla')) {
        normalizedBrowser = 'Mozilla Firefox';
      } else if (normalizedBrowser.includes('safari')) {
        normalizedBrowser = 'Safari';
      } else if (normalizedBrowser.includes('opera')) {
        normalizedBrowser = 'Opera';
      } else if (normalizedBrowser.includes('brave')) {
        normalizedBrowser = 'Brave';
      } else if (normalizedBrowser.includes('chromium')) {
        normalizedBrowser = 'Chromium';
      } else {
        // Capitalize first letter of each word for unknown browsers
        normalizedBrowser = normalizedBrowser
          .split(' ')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }

      // Aggregate counts for normalized browser names
      if (normalizedBrowser) {
        browserCounts[normalizedBrowser] = (browserCounts[normalizedBrowser] || 0) + Number(row.device_count);
      }
    });

    // Convert to array and sort by count
    const browserAnalysis: BrowserData[] = Object.entries(browserCounts)
      .map(([browser, count]) => ({ browser, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 browsers

    const result = { 
      success: true, 
      browserAnalysis 
    };

    // Cache for 10 minutes
    await executeQuery(
      "INSERT INTO analytics_cache (cache_key, cache_data, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE)) ON DUPLICATE KEY UPDATE cache_data = VALUES(cache_data), expires_at = VALUES(expires_at)",
      ["browser_analysis", JSON.stringify(result)]
    );

    return NextResponse.json(result);

  } catch (error) {
    console.error("Browser analysis error:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Internal server error" 
    }, { status: 500 });
  }
} 