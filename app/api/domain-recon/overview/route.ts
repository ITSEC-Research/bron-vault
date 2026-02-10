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
    const { targetDomain, timelineGranularity, searchType = 'domain', type } = body

    if (!targetDomain || typeof targetDomain !== 'string') {
      return NextResponse.json({ error: "targetDomain is required" }, { status: 400 })
    }

    // Get signal for passing to database queries
    const signal = getRequestSignal(request)

    let whereClause = ''
    let params: Record<string, unknown> = {}
    
    if (searchType === 'keyword') {
      const keyword = targetDomain.trim()
      const keywordMode = body.keywordMode || 'full-url'
      const parsed = parseSearchQuery(keyword)
      const built = buildKeywordReconCondition(parsed, keywordMode)
      whereClause = `WHERE ${built.condition}`
      params = built.params
    } else {
      const parsed = parseSearchQuery(targetDomain)
      const built = buildDomainReconCondition(parsed, { notNullCheck: true })
      whereClause = `WHERE ${built.condition}`
      params = built.params
    }

    console.log("🔍 Overview API called:", { targetDomain, searchType, timelineGranularity, type })

    // ============================================
    // SPLIT REQUESTS STRATEGY
    // Support query parameter 'type' for progressive loading:
    // - type=stats: Return only Subdomains + Paths (fast data ~200ms)
    // - type=timeline: Return only Timeline (slow data ~2s)
    // - no type or type=all: Return all (backward compatible)
    // ============================================
    
    if (type === 'stats') {
      // Check abort before expensive operations
      throwIfAborted(request)
      
      // Fast data: Subdomains + Paths only
      const [topSubdomains, topPaths] = await Promise.all([
        getTopSubdomains(whereClause, params, 10, searchType, body.keywordMode || 'full-url', targetDomain, signal).catch((e) => { 
          // Don't log AbortError as error
          if (e instanceof Error && e.name !== 'AbortError') {
            console.error("❌ Subdomains Error:", e)
          }
          return []
        }),
        getTopPaths(whereClause, params, 10, signal).catch((e) => { 
          if (e instanceof Error && e.name !== 'AbortError') {
            console.error("❌ Paths Error:", e)
          }
          return []
        }),
      ])
      
      // Check abort after operations
      throwIfAborted(request)

      console.log("✅ Stats data retrieved:", {
        topSubdomainsCount: topSubdomains?.length || 0,
        topPathsCount: topPaths?.length || 0,
      })

      return NextResponse.json({
        success: true,
        targetDomain,
        searchType,
        topSubdomains: topSubdomains || [],
        topPaths: topPaths || [],
      })
    }

    if (type === 'timeline') {
      // Check abort before expensive operations
      throwIfAborted(request)
      
      // Slow data: Timeline only
      const timelineData = await getTimelineData(whereClause, params, timelineGranularity || 'auto', signal).catch((e) => { 
        if (e instanceof Error && e.name !== 'AbortError') {
          console.error("❌ Timeline Error:", e)
        }
        return []
      })
      
      // Check abort after operations
      throwIfAborted(request)

      console.log("✅ Timeline data retrieved:", {
        timelineCount: timelineData?.length || 0,
        timelineSample: timelineData?.slice(0, 3),
      })

      return NextResponse.json({
        success: true,
        targetDomain,
        searchType,
        timeline: timelineData || [],
      })
    }

    // Default: Return all data (backward compatible)
    // Check abort before expensive operations
    throwIfAborted(request)
    
    const [timelineData, topSubdomains, topPaths] = await Promise.all([
      getTimelineData(whereClause, params, timelineGranularity || 'auto', signal).catch((e) => { 
        if (e instanceof Error && e.name !== 'AbortError') {
          console.error("❌ Timeline Error:", e)
        }
        return []
      }),
      getTopSubdomains(whereClause, params, 10, searchType, body.keywordMode || 'full-url', targetDomain, signal).catch((e) => { 
        if (e instanceof Error && e.name !== 'AbortError') {
          console.error("❌ Subdomains Error:", e)
        }
        return []
      }),
      getTopPaths(whereClause, params, 10, signal).catch((e) => { 
        if (e instanceof Error && e.name !== 'AbortError') {
          console.error("❌ Paths Error:", e)
        }
        return []
      }),
    ])
    
    // Check abort after operations
    throwIfAborted(request)

    console.log("✅ Overview data retrieved:", {
      timelineCount: timelineData?.length || 0,
      topSubdomainsCount: topSubdomains?.length || 0,
      topPathsCount: topPaths?.length || 0,
      timelineSample: timelineData?.slice(0, 3),
    })

    return NextResponse.json({
      success: true,
      targetDomain,
      searchType,
      timeline: timelineData || [],
      topSubdomains: topSubdomains || [],
      topPaths: topPaths || [],
    })

  } catch (error) {
    // Handle abort errors gracefully
    const abortResponse = handleAbortError(error)
    if (abortResponse) {
      return abortResponse
    }
    
    // Handle other errors
    console.error("❌ Error in overview API:", error)
    return NextResponse.json({ error: "Failed to get overview data" }, { status: 500 })
  }
}

async function getTimelineData(whereClause: string, params: Record<string, unknown>, granularity: string, signal?: AbortSignal) {
  // OPTIMIZED DATE PARSING STRATEGY (POST-NORMALIZATION)
  // After normalization, log_date is already in standard YYYY-MM-DD format
  // Query becomes very simple and fast - directly toDate() without complex parsing
  // 
  // Benefits:
  // 1. toDate() is very fast for YYYY-MM-DD format (native ClickHouse format)
  // 2. No need for regex extract or parseDateTimeBestEffort (very expensive)
  // 3. Query is simpler and easier to maintain
  const getDateExpr = () => {
    return `if(
      si.log_date IS NOT NULL AND si.log_date != '',
      toDate(si.log_date),  // ← Direct convert, already normalized (YYYY-MM-DD)!
      toDate(c.created_at)
    )`
  }

  // Check range first for auto granularity
  const dateExpr = getDateExpr()
  const dateRangeResult = (await executeClickHouseQuery(
    `SELECT 
      min(${dateExpr}) as min_date,
      max(${dateExpr}) as max_date,
      dateDiff('day', min(${dateExpr}), max(${dateExpr})) as day_range
    FROM credentials c
    LEFT JOIN devices d ON c.device_id = d.device_id
    LEFT JOIN systeminformation si ON d.device_id = si.device_id
    ${whereClause}`,
    params,
    signal
  )) as any[]

  const range = dateRangeResult[0]
  if (!range || !range.min_date) {
    console.warn("⚠️ No date range found, returning empty timeline")
    return []
  }

  let actualGranularity = granularity
  if (granularity === 'auto') {
    const days = Number(range?.day_range) || 0
    console.log("📅 Day range:", days)
    if (days < 30) {
      actualGranularity = 'daily'
    } else if (days <= 90) {
      actualGranularity = 'weekly'
    } else {
      actualGranularity = 'monthly'
    }
    console.log("📅 Auto-selected granularity:", actualGranularity)
  }

  let query = ''
  if (actualGranularity === 'daily') {
    query = `SELECT toDate(${dateExpr}) as date, count() as credential_count
    FROM credentials c
    LEFT JOIN devices d ON c.device_id = d.device_id
    LEFT JOIN systeminformation si ON d.device_id = si.device_id
    ${whereClause} GROUP BY date ORDER BY date ASC`
  } else if (actualGranularity === 'weekly') {
    query = `SELECT formatDateTime(${dateExpr}, '%Y-%V') as week, min(toDate(${dateExpr})) as date, count() as credential_count
    FROM credentials c
    LEFT JOIN devices d ON c.device_id = d.device_id
    LEFT JOIN systeminformation si ON d.device_id = si.device_id
    ${whereClause} GROUP BY week ORDER BY date ASC`
  } else {
    query = `SELECT formatDateTime(${dateExpr}, '%Y-%m') as month, min(toStartOfMonth(${dateExpr})) as date, count() as credential_count
    FROM credentials c
    LEFT JOIN devices d ON c.device_id = d.device_id
    LEFT JOIN systeminformation si ON d.device_id = si.device_id
    ${whereClause} GROUP BY month ORDER BY date ASC`
  }

  console.log("📅 Executing timeline query with granularity:", actualGranularity)
  const result = (await executeClickHouseQuery(query, params, signal)) as any[]

  console.log("📊 Timeline query result:", result.length, "entries")

  return result.map((row: any) => ({
    date: row.date ? String(row.date).split('T')[0] : '',
      credentialCount: Number(row.credential_count) || 0,
  })).filter((i: any) => i.date)
}

async function getTopSubdomains(
  whereClause: string, 
  params: Record<string, unknown>, 
  limit: number,
  searchType: string,
  keywordMode: string,
  keyword: string,
  signal?: AbortSignal
) {
  // SECURITY: Validate limit parameter
  const safeLimit = Math.min(1000, Math.max(1, Math.floor(Number(limit)) || 10))
  
  // IMPORTANT: Use domain() native function with fallback extract() regex
  const hostnameExpr = `if(
    length(domain(c.url)) > 0,
    domain(c.url),
    extract(c.url, '^(?:https?://)?([^/:]+)')
  )`
  
  let query = ''
  const queryParams: Record<string, any> = { ...params, queryLimit: safeLimit }
  
  if (searchType === 'keyword' && keywordMode === 'domain-only' && keyword) {
    query = `SELECT full_hostname, credential_count FROM (
        SELECT ${hostnameExpr} as full_hostname, count() as credential_count
        FROM credentials c ${whereClause} GROUP BY full_hostname
      ) WHERE full_hostname ilike {keyword:String} ORDER BY credential_count DESC LIMIT {queryLimit:UInt32}`
    queryParams.keyword = `%${keyword}%`
  } else {
    query = `SELECT ${hostnameExpr} as full_hostname, count() as credential_count
    FROM credentials c ${whereClause} GROUP BY full_hostname ORDER BY credential_count DESC LIMIT {queryLimit:UInt32}`
  }
  
  const result = (await executeClickHouseQuery(query, queryParams, signal)) as any[]

  // IMPORTANT: Cast count() to Number (ClickHouse returns String)
  return result.map((row: any) => ({
    fullHostname: row.full_hostname || '',
    credentialCount: Number(row.credential_count) || 0,
  }))
}

async function getTopPaths(whereClause: string, params: Record<string, unknown>, limit: number, signal?: AbortSignal) {
  // SECURITY: Validate limit parameter
  const safeLimit = Math.min(1000, Math.max(1, Math.floor(Number(limit)) || 10))
  
  // IMPORTANT: Use path() native function. 
  // If path() returns empty string (for root), we return '/'
  const pathExpr = `if(length(path(c.url)) > 0, path(c.url), '/')`
  
  const result = (await executeClickHouseQuery(
    `SELECT ${pathExpr} as path, count() as credential_count
    FROM credentials c
    ${whereClause}
    GROUP BY path
    ORDER BY credential_count DESC
    LIMIT {queryLimit:UInt32}`,
    { ...params, queryLimit: safeLimit },
    signal
  )) as any[]

  // IMPORTANT: Cast count() to Number (ClickHouse returns String)
  return result.map((row: any) => ({
    path: row.path || '/',
    credentialCount: Number(row.credential_count) || 0,
  }))
}
