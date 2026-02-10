import { NextRequest, NextResponse } from "next/server"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"
import { validateRequest } from "@/lib/auth"
import { throwIfAborted, getRequestSignal, handleAbortError } from "@/lib/api-helpers"
import { parseSearchQuery } from "@/lib/query-parser"
import { buildDomainReconCondition, buildKeywordReconCondition } from "@/lib/search-query-builder"

// ============================================
// CLICKHOUSE EXPRESSIONS (CONSTANTS) - DRY Principle
// ============================================

/**
 * Extract Hostname (Domain)
 * OPTIMIZED: Uses native domain() function for maximum performance (C++ level execution)
 * Strategy:
 * 1. Try domain() native function first (fastest)
 * 2. If empty and URL doesn't have scheme, add 'http://' prefix and try again
 * 3. If still empty, use regex fallback for edge cases
 */
const HOSTNAME_EXPR = `if(
  length(domain(c.url)) > 0,
  domain(c.url),
  if(
    c.url NOT LIKE 'http://%' AND c.url NOT LIKE 'https://%',
    domain(concat('http://', c.url)),
    coalesce(
      replaceRegexpOne(
        replaceRegexpOne(
          replaceRegexpOne(c.url, '^https?://', ''),
          '/.*$', ''
        ),
        ':.*$', ''
      ),
      ''
    )
  )
)`

/**
 * Extract Path
 * OPTIMIZED: Uses native path() function for maximum performance (C++ level execution)
 * path() automatically removes query string (?) and fragment (#)
 * Strategy:
 * 1. Try path() native function first (fastest)
 * 2. If empty and URL doesn't have scheme but has path separator, add 'http://' prefix and try again
 * 3. Default to '/' if no path found
 */
const PATH_EXPR = `if(
  length(path(c.url)) > 0,
  path(c.url),
  if(
    c.url NOT LIKE 'http://%' AND c.url NOT LIKE 'https://%' AND c.url LIKE '%/%',
    path(concat('http://', c.url)),
    '/'
  )
)`

// ============================================
// HELPER FUNCTIONS
// ============================================

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
    const { targetDomain, filters, pagination, searchType = 'domain', deduplicate = false } = body

    if (!targetDomain || typeof targetDomain !== 'string') {
      return NextResponse.json({ error: "targetDomain is required" }, { status: 400 })
    }

    // Get signal for passing to database queries
    const signal = getRequestSignal(request)

    // ============================================
    // CODE PATH SEPARATION - CLEAR & MAINTAINABLE
    // ============================================
    
    // Check abort before expensive operations
    throwIfAborted(request)
    
    if (searchType === 'keyword') {
      // ===== KEYWORD SEARCH PATH =====
      const keyword = targetDomain.trim()
      const keywordMode = body.keywordMode || 'full-url'
      const parsed = parseSearchQuery(keyword)
      const built = buildKeywordReconCondition(parsed, keywordMode)
      const whereClause = `WHERE ${built.condition}`
      const subdomainsData = await getSubdomainsData(whereClause, built.params, filters, pagination, deduplicate, signal)

      // Check abort after operations
      throwIfAborted(request)

      return NextResponse.json({
        success: true,
        targetDomain: keyword,
        searchType: 'keyword',
        subdomains: subdomainsData.data || [],
        pagination: subdomainsData.pagination,
      })
    } else {
      // ===== DOMAIN SEARCH PATH =====
      const parsed = parseSearchQuery(targetDomain)
      const built = buildDomainReconCondition(parsed)
      const whereClause = `WHERE ${built.condition}`
      const subdomainsData = await getSubdomainsData(whereClause, built.params, filters, pagination, deduplicate, signal)

      // Check abort after operations
      throwIfAborted(request)

    return NextResponse.json({
      success: true,
      targetDomain,
        searchType: 'domain',
      subdomains: subdomainsData.data || [],
      pagination: subdomainsData.pagination,
    })
    }
  } catch (error) {
    // Handle abort errors gracefully
    const abortResponse = handleAbortError(error)
    if (abortResponse) {
      return abortResponse
    }
    
    // Handle other errors
    console.error("❌ Error in subdomains API:", error)
    return NextResponse.json(
      {
        error: "Failed to get subdomains data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

async function getSubdomainsData(
  whereClause: string,
  baseParams: Record<string, unknown>,
  filters?: any,
  pagination?: any,
  deduplicate: boolean = false,
  signal?: AbortSignal
) {
  // Validate and sanitize pagination parameters
  const page = Math.max(1, Number(pagination?.page) || 1)
  const limit = Math.max(1, Math.min(Number(pagination?.limit) || 50, 1000)) // Max 1000 for safety
  const offset = Math.max(0, (page - 1) * limit)
  
  const allowedSortColumns = ['credential_count', 'full_hostname', 'path']
  const sortBy = allowedSortColumns.includes(pagination?.sortBy) 
    ? pagination.sortBy 
    : 'credential_count'
  const sortOrder = (pagination?.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

  const params: Record<string, unknown> = { ...baseParams }

  // Build final WHERE clause with filters
  let finalWhereClause = whereClause
  if (filters?.subdomain) {
    const subdomainParam = `subdomainFilter${Object.keys(params).length}`
    finalWhereClause += ` AND ${HOSTNAME_EXPR} ilike {${subdomainParam}:String}`
    params[subdomainParam] = `%${filters.subdomain}%`
  }

  if (filters?.path) {
    const pathParam = `pathFilter${Object.keys(params).length}`
    finalWhereClause += ` AND c.url ilike {${pathParam}:String}`
    params[pathParam] = `%${filters.path}%`
  }

  // ============================================
  // OPTIMIZED QUERY: TOTAL COUNT
  // ============================================
  // OPTIMIZED: Use uniq() with tuple (multiple arguments) instead of concat()
  // This avoids string concatenation for millions of rows, much more efficient
  // uniq() with tuple uses tuple comparison which is faster than string concat
  // When deduplicate=true, count only unique hostnames (without path)
  const countQuery = deduplicate
    ? `
      SELECT uniq(${HOSTNAME_EXPR}) as total
      FROM credentials c
      ${finalWhereClause}
    `
    : `
      SELECT uniq(
        ${HOSTNAME_EXPR}, 
        ${PATH_EXPR}
      ) as total
      FROM credentials c
      ${finalWhereClause}
    `

  const countResult = (await executeClickHouseQuery(countQuery, params, signal)) as any[]
  const total = Number(countResult[0]?.total || 0)

  // ============================================
  // OPTIMIZED QUERY: DATA
  // ============================================
  // OPTIMIZED: 
  // 1. Use native path() and domain() functions (C++ level, very fast)
  // 2. Use expressions in GROUP BY (not aliases) for compatibility
  // 3. SECURITY: Use parameterized LIMIT/OFFSET
  // When deduplicate=true, GROUP BY only hostname (aggregate all paths)
  const sortByExpr = sortBy === 'full_hostname' 
    ? HOSTNAME_EXPR 
    : sortBy === 'path' 
      ? (deduplicate ? HOSTNAME_EXPR : PATH_EXPR) // When deduplicated, path sort falls back to hostname
      : 'credential_count'

  // Add pagination params
  const dataParams: Record<string, any> = { ...params, queryLimit: limit, queryOffset: offset }

  const dataQuery = deduplicate
    ? `
      SELECT 
        ${HOSTNAME_EXPR} as full_hostname,
        '(multiple)' as path,
        count() as credential_count
      FROM credentials c
      ${finalWhereClause}
      GROUP BY ${HOSTNAME_EXPR}
      ORDER BY ${sortByExpr} ${sortOrder}
      LIMIT {queryLimit:UInt32} OFFSET {queryOffset:UInt32}
    `
    : `
      SELECT 
        ${HOSTNAME_EXPR} as full_hostname,
        ${PATH_EXPR} as path,
        count() as credential_count
      FROM credentials c
      ${finalWhereClause}
      GROUP BY ${HOSTNAME_EXPR}, ${PATH_EXPR}
      ORDER BY ${sortByExpr} ${sortOrder}
      LIMIT {queryLimit:UInt32} OFFSET {queryOffset:UInt32}
    `

  const data = (await executeClickHouseQuery(dataQuery, dataParams, signal)) as any[]

  return {
    data: data.map((row: any) => ({
      fullHostname: row.full_hostname || '',
      path: row.path || '/',
      credentialCount: Number(row.credential_count || 0), // PENTING: Cast ke Number (ClickHouse return String)
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

