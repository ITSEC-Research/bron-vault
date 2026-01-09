import { NextRequest, NextResponse } from "next/server"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"
import { validateRequest } from "@/lib/auth"
import { throwIfAborted, getRequestSignal, handleAbortError } from "@/lib/api-helpers"

function buildDomainWhereClause(targetDomain: string): { whereClause: string; params: Record<string, string> } {
  const whereClause = `WHERE (
    domain = {domain:String} OR 
    domain ilike concat('%.', {domain:String}) OR
    url ilike {pattern1:String} OR
    url ilike {pattern2:String} OR
    url ilike {pattern3:String} OR
    url ilike {pattern4:String}
  )`
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

function buildKeywordWhereClause(keyword: string, mode: 'domain-only' | 'full-url' = 'full-url'): { whereClause: string; params: Record<string, string> } {
  if (mode === 'domain-only') {
    // Use safe extract/domain without array access
    // IMPORTANT: Use domain() native function with fallback extract() regex
    const hostnameExpr = `if(
      length(domain(url)) > 0,
      domain(url),
      extract(url, '^(?:https?://)?([^/:]+)')
    )`
    const whereClause = `WHERE ${hostnameExpr} ilike {keyword:String} AND url IS NOT NULL`
    return { whereClause, params: { keyword: `%${keyword}%` } }
  } else {
    const whereClause = `WHERE url ilike {keyword:String} AND url IS NOT NULL`
    return { whereClause, params: { keyword: `%${keyword}%` } }
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
    const { targetDomain, searchType = 'domain' } = body

    if (!targetDomain || typeof targetDomain !== 'string') {
      return NextResponse.json({ error: "targetDomain is required" }, { status: 400 })
    }

    // Get signal for passing to database queries
    const signal = getRequestSignal(request)

    let whereClause = ''
    let params: Record<string, string> = {}
    
    if (searchType === 'keyword') {
      const keyword = targetDomain.trim()
      const mode = body.keywordMode || 'full-url'
      const built = buildKeywordWhereClause(keyword, mode)
      whereClause = built.whereClause
      params = built.params
    } else {
    let normalizedDomain = targetDomain.trim().toLowerCase()
      normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0]
      const built = buildDomainWhereClause(normalizedDomain)
      whereClause = built.whereClause
      params = built.params
    }

    // Check abort before expensive operations
    throwIfAborted(request)
    
    const summary = await getSummaryStats(whereClause, params, signal)
    
    // Check abort after operations
    throwIfAborted(request)

    return NextResponse.json({
      success: true,
      targetDomain,
      searchType,
      summary,
    })
  } catch (error) {
    // Handle abort errors gracefully
    const abortResponse = handleAbortError(error)
    if (abortResponse) {
      return abortResponse
    }
    
    // Handle other errors
    console.error("❌ Error in summary API:", error)
    return NextResponse.json({ error: "Failed to get summary statistics" }, { status: 500 })
  }
}

async function getSummaryStats(whereClause: string, params: Record<string, unknown>, signal?: AbortSignal) {
  // 1. Total Subdomains: Use native domain() with fallback extract() regex
  // IMPORTANT: Avoid array access, use native ClickHouse functions
  const hostnameExpr = `if(
    length(domain(url)) > 0,
    domain(url),
    extract(url, '^(?:https?://)?([^/:]+)')
  )`
  
  // 2. Total Paths: Use native path()
  // IMPORTANT: path() returns empty string for root, so we return '/'
  const pathExpr = `if(length(path(url)) > 0, path(url), '/')`

  // Execute all counts in parallel
  const [subRes, pathRes, credRes, reusedRes, devRes] = await Promise.all([
    executeClickHouseQuery(`SELECT uniq(${hostnameExpr}) as total FROM credentials ${whereClause}`, params, signal),
    executeClickHouseQuery(`SELECT uniq(${pathExpr}) as total FROM credentials ${whereClause}`, params, signal),
    executeClickHouseQuery(`SELECT count() as total FROM credentials ${whereClause}`, params, signal),
    executeClickHouseQuery(`SELECT count() as total FROM (
      SELECT username, password, url FROM credentials ${whereClause} GROUP BY username, password, url HAVING count() > 1
    )`, params, signal),
    executeClickHouseQuery(`SELECT uniq(device_id) as total FROM credentials ${whereClause}`, params, signal)
  ])

  // IMPORTANT: Cast all results to Number (ClickHouse returns String)
  return {
    totalSubdomains: Number((subRes as any[])[0]?.total) || 0,
    totalPaths: Number((pathRes as any[])[0]?.total) || 0,
    totalCredentials: Number((credRes as any[])[0]?.total) || 0,
    totalReusedCredentials: Number((reusedRes as any[])[0]?.total) || 0,
    totalDevices: Number((devRes as any[])[0]?.total) || 0,
  }
}
