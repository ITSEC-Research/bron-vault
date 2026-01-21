import { NextRequest, NextResponse } from "next/server";
import { executeQuery as executeMySQLQuery } from "@/lib/mysql";
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse";
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
    // Check cache first (analytics_cache tetap di MySQL - operational table)
    const cacheResult = (await executeMySQLQuery(
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
      } catch (_e) {
        console.warn("Browser analysis cache parse failed, will recalc")
      }

      if (parsed && parsed.success && parsed.browserAnalysis) {
        return NextResponse.json(parsed)
      }
    }

    // Get all (device_id, browser) pairs to properly count unique devices per normalized browser
    // This ensures that if a device has multiple browser versions, it's only counted once per normalized browser name
    const results = await executeClickHouseQuery(`
      SELECT 
        device_id,
        browser
      FROM credentials 
      WHERE browser IS NOT NULL AND browser != ''
    `) as any[];

    if (!Array.isArray(results)) {
      return NextResponse.json({ success: false, error: "Invalid data format" }, { status: 500 });
    }

    // Helper function to normalize browser name
    const normalizeBrowserName = (originalBrowser: string): string => {
      if (!originalBrowser) return '';

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

      return normalizedBrowser;
    };

    // Track unique device_id per normalized browser name using Map
    // Key: normalized browser name, Value: Set of device_id
    const browserDeviceMap = new Map<string, Set<string>>();
    
    results.forEach((row) => {
      const deviceId = String(row.device_id || '');
      const originalBrowser = String(row.browser || '');
      
      if (!deviceId || !originalBrowser) return;

      const normalizedBrowser = normalizeBrowserName(originalBrowser);
      
      if (normalizedBrowser) {
        if (!browserDeviceMap.has(normalizedBrowser)) {
          browserDeviceMap.set(normalizedBrowser, new Set());
        }
        // Add device_id to the set (Set automatically handles duplicates)
        browserDeviceMap.get(normalizedBrowser)!.add(deviceId);
      }
    });

    // Convert Map to array with count of unique devices
    const browserCounts: { [key: string]: number } = {};
    browserDeviceMap.forEach((deviceSet, normalizedBrowser) => {
      browserCounts[normalizedBrowser] = deviceSet.size;
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
    // analytics_cache tetap di MySQL (operational table)
    await executeMySQLQuery(
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