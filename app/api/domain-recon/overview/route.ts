import { NextRequest, NextResponse } from "next/server"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"
import { validateRequest } from "@/lib/auth"

/**
 * Build WHERE clause for domain matching (ClickHouse version)
 * Uses named parameters
 */
function buildDomainWhereClause(targetDomain: string): { whereClause: string; params: Record<string, string> } {
  const whereClause = `WHERE (
    c.domain = {domain:String} OR 
    c.domain ilike concat('%.', {domain:String}) OR
    c.url ilike {pattern1:String} OR
    c.url ilike {pattern2:String} OR
    c.url ilike {pattern3:String} OR
    c.url ilike {pattern4:String}
  ) AND c.domain IS NOT NULL`
  
  return {
    whereClause,
    params: {
      domain: targetDomain,
      pattern1: `%://${targetDomain}/%`,
      pattern2: `%://${targetDomain}:%`,
      pattern3: `%://%.${targetDomain}/%`,
      pattern4: `%://%.${targetDomain}:%`
    }
  }
}

/**
 * Build WHERE clause for keyword search (ClickHouse version)
 */
function buildKeywordWhereClause(keyword: string, mode: 'domain-only' | 'full-url' = 'full-url'): { whereClause: string; params: Record<string, string> } {
  if (mode === 'domain-only') {
    // Extract hostname safe logic without Arrays
    // IMPORTANT: Use domain() native function with fallback extract() regex
    const hostnameExpr = `if(
      length(domain(c.url)) > 0,
      domain(c.url),
      extract(c.url, '^(?:https?://)?([^/:]+)')
    )`
    
    const whereClause = `WHERE ${hostnameExpr} ilike {keyword:String} AND c.url IS NOT NULL`
    return {
      whereClause,
      params: { keyword: `%${keyword}%` }
    }
  } else {
    const whereClause = `WHERE c.url ilike {keyword:String} AND c.url IS NOT NULL`
    return {
      whereClause,
      params: { keyword: `%${keyword}%` }
    }
  }
}

export async function POST(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { targetDomain, timelineGranularity, searchType = 'domain', type } = body

    if (!targetDomain || typeof targetDomain !== 'string') {
      return NextResponse.json({ error: "targetDomain is required" }, { status: 400 })
    }

    let whereClause = ''
    let params: Record<string, string> = {}
    
    if (searchType === 'keyword') {
      const keyword = targetDomain.trim()
      const keywordMode = body.keywordMode || 'full-url'
      const built = buildKeywordWhereClause(keyword, keywordMode)
      whereClause = built.whereClause
      params = built.params
    } else {
    let normalizedDomain = targetDomain.trim().toLowerCase()
      normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0]
      const built = buildDomainWhereClause(normalizedDomain)
      whereClause = built.whereClause
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
      // Fast data: Subdomains + Paths only
      const [topSubdomains, topPaths] = await Promise.all([
        getTopSubdomains(whereClause, params, 10, searchType, body.keywordMode || 'full-url', targetDomain).catch((e) => { 
          console.error("❌ Subdomains Error:", e)
          return []
        }),
        getTopPaths(whereClause, params, 10).catch((e) => { 
          console.error("❌ Paths Error:", e)
          return []
        }),
      ])

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
      // Slow data: Timeline only
      const timelineData = await getTimelineData(whereClause, params, timelineGranularity || 'auto').catch((e) => { 
        console.error("❌ Timeline Error:", e)
        return []
      })

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
    const [timelineData, topSubdomains, topPaths] = await Promise.all([
      getTimelineData(whereClause, params, timelineGranularity || 'auto').catch((e) => { 
        console.error("❌ Timeline Error:", e)
        return []
      }),
      getTopSubdomains(whereClause, params, 10, searchType, body.keywordMode || 'full-url', targetDomain).catch((e) => { 
        console.error("❌ Subdomains Error:", e)
        return []
      }),
      getTopPaths(whereClause, params, 10).catch((e) => { 
        console.error("❌ Paths Error:", e)
        return []
      }),
    ])

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
    console.error("❌ Error in overview API:", error)
    return NextResponse.json({ error: "Failed to get overview data" }, { status: 500 })
  }
}

async function getTimelineData(whereClause: string, params: Record<string, string>, granularity: string) {
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
    params
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
  const result = (await executeClickHouseQuery(query, params)) as any[]

  console.log("📊 Timeline query result:", result.length, "entries")

  return result.map((row: any) => ({
    date: row.date ? String(row.date).split('T')[0] : '',
      credentialCount: Number(row.credential_count) || 0,
  })).filter((i: any) => i.date)
}

async function getTopSubdomains(
  whereClause: string, 
  params: Record<string, string>, 
  limit: number,
  searchType: string,
  keywordMode: string,
  keyword: string
) {
  // IMPORTANT: Use domain() native function with fallback extract() regex
  const hostnameExpr = `if(
    length(domain(c.url)) > 0,
    domain(c.url),
    extract(c.url, '^(?:https?://)?([^/:]+)')
  )`
  
  let query = ''
  const queryParams: Record<string, string> = { ...params }
  
  if (searchType === 'keyword' && keywordMode === 'domain-only' && keyword) {
    query = `SELECT full_hostname, credential_count FROM (
        SELECT ${hostnameExpr} as full_hostname, count() as credential_count
        FROM credentials c ${whereClause} GROUP BY full_hostname
      ) WHERE full_hostname ilike {keyword:String} ORDER BY credential_count DESC LIMIT ${Number(limit)}`
    queryParams.keyword = `%${keyword}%`
  } else {
    query = `SELECT ${hostnameExpr} as full_hostname, count() as credential_count
    FROM credentials c ${whereClause} GROUP BY full_hostname ORDER BY credential_count DESC LIMIT ${Number(limit)}`
  }
  
  const result = (await executeClickHouseQuery(query, queryParams)) as any[]

  // IMPORTANT: Cast count() to Number (ClickHouse returns String)
  return result.map((row: any) => ({
    fullHostname: row.full_hostname || '',
    credentialCount: Number(row.credential_count) || 0,
  }))
}

async function getTopPaths(whereClause: string, params: Record<string, string>, limit: number) {
  // IMPORTANT: Use path() native function. 
  // If path() returns empty string (for root), we return '/'
  const pathExpr = `if(length(path(c.url)) > 0, path(c.url), '/')`
  
  const result = (await executeClickHouseQuery(
    `SELECT ${pathExpr} as path, count() as credential_count
    FROM credentials c
    ${whereClause}
    GROUP BY path
    ORDER BY credential_count DESC
    LIMIT ${Number(limit)}`,
    params
  )) as any[]

  // IMPORTANT: Cast count() to Number (ClickHouse returns String)
  return result.map((row: any) => ({
    path: row.path || '/',
    credentialCount: Number(row.credential_count) || 0,
  }))
}
