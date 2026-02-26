import { NextRequest, NextResponse } from "next/server"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"
import { validateRequest } from "@/lib/auth"
import { throwIfAborted, getRequestSignal, handleAbortError } from "@/lib/api-helpers"

// ============================================
// CLICKHOUSE EXPRESSIONS (CONSTANTS) - DRY Principle
// ============================================

/**
 * Extract Hostname (Domain)
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
    const { hostname, limit = 20, offset = 0 } = body

    if (!hostname || typeof hostname !== 'string') {
      return NextResponse.json({ error: "hostname is required" }, { status: 400 })
    }

    // Get signal for passing to database queries
    const signal = getRequestSignal(request)

    // Validate limit and offset for pagination
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100))
    const safeOffset = Math.max(0, Math.floor(Number(offset) || 0))

    // Check abort before expensive operations
    throwIfAborted(request)

    // Query paths for specific hostname (with pagination)
    const dataQuery = `
      SELECT 
        ${PATH_EXPR} as path,
        count() as credential_count
      FROM credentials c
      WHERE ${HOSTNAME_EXPR} = {hostname:String}
      GROUP BY ${PATH_EXPR}
      ORDER BY credential_count DESC
      LIMIT {queryLimit:UInt32} OFFSET {queryOffset:UInt32}
    `

    const data = (await executeClickHouseQuery(dataQuery, { 
      hostname: hostname.trim(),
      queryLimit: safeLimit,
      queryOffset: safeOffset,
    }, signal)) as any[]

    // Get total paths count
    const countQuery = `
      SELECT uniq(${PATH_EXPR}) as total
      FROM credentials c
      WHERE ${HOSTNAME_EXPR} = {hostname:String}
    `
    const countResult = (await executeClickHouseQuery(countQuery, { hostname: hostname.trim() }, signal)) as any[]
    const totalPaths = Number(countResult[0]?.total || 0)
    
    // Check abort after operations
    throwIfAborted(request)

    return NextResponse.json({
      success: true,
      hostname,
      paths: data.map((row: any) => ({
        path: row.path || '/',
        credentialCount: Number(row.credential_count || 0),
      })),
      total: totalPaths,
      hasMore: totalPaths > safeOffset + safeLimit,
      limit: safeLimit,
      offset: safeOffset,
    })
  } catch (error) {
    // Handle abort errors gracefully
    const abortResponse = handleAbortError(error)
    if (abortResponse) {
      return abortResponse
    }
    
    // Handle other errors
    console.error("❌ Error in paths API:", error)
    return NextResponse.json(
      {
        error: "Failed to get paths data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
