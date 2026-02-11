import { NextRequest, NextResponse } from "next/server"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"
import { validateRequest } from "@/lib/auth"
import { throwIfAborted, getRequestSignal, handleAbortError } from "@/lib/api-helpers"
import { parseSearchQuery } from "@/lib/query-parser"
import { buildDomainReconCondition, buildKeywordReconCondition } from "@/lib/search-query-builder"

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
    let params: Record<string, unknown>

    if (searchType === 'keyword') {
      const keyword = targetDomain.trim()
      const mode = keywordMode || 'full-url'
      const parsed = parseSearchQuery(keyword)
      const built = buildKeywordReconCondition(parsed, mode)
      whereClause = `WHERE ${built.condition}`
      params = built.params
    } else {
      const parsed = parseSearchQuery(targetDomain)
      const built = buildDomainReconCondition(parsed, { notNullCheck: true })
      whereClause = `WHERE ${built.condition}`
      params = built.params
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

