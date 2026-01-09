import { NextRequest, NextResponse } from "next/server"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"
import { validateRequest } from "@/lib/auth"
import { throwIfAborted, getRequestSignal, handleAbortError } from "@/lib/api-helpers"

/**
 * Build WHERE clause for domain matching that supports subdomains (ClickHouse version)
 * OPTIMIZED: Avoid heavy string manipulation in SQL
 * Uses named parameters for ClickHouse
 */
function buildDomainWhereClause(targetDomain: string): { whereClause: string; params: Record<string, string> } {
  // Use ilike for case-insensitive matching (data in DB might be mixed case)
  const whereClause = `WHERE (
    c.domain = {domain:String} OR 
    c.domain ilike concat('%.', {domain:String}) OR
    c.url ilike {pattern1:String} OR
    c.url ilike {pattern2:String}
  ) AND c.domain IS NOT NULL`
  
  return {
    whereClause,
    params: {
      domain: targetDomain,                              // Exact domain match
      pattern1: `%://${targetDomain}/%`,                   // Match: https://target.com/
      pattern2: `%://${targetDomain}:%`                    // Match: https://target.com:8080/
    }
  }
}

/**
 * Build WHERE clause for keyword search (ClickHouse version)
 * OPTIMIZED: Use simple LIKE instead of heavy string manipulation
 * Uses ilike for case-insensitive search
 */
function buildKeywordWhereClause(keyword: string, mode: 'domain-only' | 'full-url' = 'full-url'): { whereClause: string; params: Record<string, string> } {
  if (mode === 'domain-only') {
    // For domain-only, check both domain column and URL (ClickHouse: use ilike)
    const whereClause = `WHERE (
      c.domain ilike {keyword:String} OR
      c.url ilike {pattern1:String} OR
      c.url ilike {pattern2:String}
    ) AND c.url IS NOT NULL`
    return {
      whereClause,
      params: {
        keyword: `%${keyword}%`,           // Domain column contains keyword
        pattern1: `%://%${keyword}%/%`,     // URL contains keyword in hostname
        pattern2: `%://%${keyword}%:%`       // URL contains keyword in hostname with port
      }
    }
  } else {
    // Full URL mode: search keyword anywhere in URL (ClickHouse: use ilike)
    const whereClause = `WHERE c.url ilike {keyword:String} AND c.url IS NOT NULL`
    return {
      whereClause,
      params: { keyword: `%${keyword}%` }
    }
  }
}

export async function POST(request: NextRequest) {
  // ✅ Check abort VERY EARLY - before validateRequest
  throwIfAborted(request)
  
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if request was aborted early
    throwIfAborted(request)
    
    const body = await request.json()
    const { targetDomain, searchType = 'domain', keywordMode } = body

    if (!targetDomain || typeof targetDomain !== 'string') {
      return NextResponse.json({ error: "targetDomain is required" }, { status: 400 })
    }

    // Get signal for passing to database queries
    const signal = getRequestSignal(request)

    let whereClause: string
    let params: Record<string, string>

    if (searchType === 'keyword') {
      const keyword = targetDomain.trim()
      const mode = keywordMode || 'full-url'
      const result = buildKeywordWhereClause(keyword, mode)
      whereClause = result.whereClause
      params = result.params
    } else {
      let normalizedDomain = targetDomain.trim().toLowerCase()
      normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '')
      normalizedDomain = normalizedDomain.replace(/^www\./, '')
      normalizedDomain = normalizedDomain.replace(/\/$/, '')
      normalizedDomain = normalizedDomain.split('/')[0].split(':')[0]

      const result = buildDomainWhereClause(normalizedDomain)
      whereClause = result.whereClause
      params = result.params
    }

    // Check abort before expensive operations
    throwIfAborted(request)

    console.log("🔑 Getting top passwords (optimized query)...")
    
    // OPTIMIZED QUERY (ClickHouse):
    // 1. Convert COUNT(DISTINCT device_id) -> uniq(device_id)
    // 2. Convert LENGTH(TRIM(password)) -> length(trimBoth(password))
    // 3. Convert REGEXP -> match
    // Result: 1 password per device for the domain, then count how many devices use each password
    const result = (await executeClickHouseQuery(
      `SELECT 
        c.password,
        uniq(c.device_id) as total_count
      FROM credentials c
      ${whereClause}
      AND c.password IS NOT NULL
      AND length(trimBoth(c.password)) > 2
      AND c.password NOT IN ('', ' ', 'null', 'undefined', 'N/A', 'n/a', 'none', 'None', 'NONE', 'blank', 'Blank', 'BLANK', 'empty', 'Empty', 'EMPTY', '[NOT_SAVED]')
      AND c.password NOT LIKE '%[NOT_SAVED]%'
      AND NOT match(c.password, '^[[:space:]]*$')
      GROUP BY c.password
      ORDER BY total_count DESC, c.password ASC
      LIMIT 10`,
      params,
      signal
    )) as any[]
    
    // Check abort after operations
    throwIfAborted(request)

    console.log("🔑 Top passwords query result:", result.length, "items")
    
    const topPasswords = result.map((row: any) => ({
      password: row.password || '',
      total_count: Number(row.total_count) || 0,
    }))

    return NextResponse.json({
      success: true,
      topPasswords: topPasswords || [],
    })
  } catch (error) {
    // Handle abort errors gracefully
    const abortResponse = handleAbortError(error)
    if (abortResponse) {
      return abortResponse
    }
    
    // Handle other errors
    console.error("❌ Error in passwords API:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get top passwords",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

