import { NextRequest, NextResponse } from "next/server"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"
import { validateRequest } from "@/lib/auth"

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
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { hostname, limit = 20 } = body

    if (!hostname || typeof hostname !== 'string') {
      return NextResponse.json({ error: "hostname is required" }, { status: 400 })
    }

    // Validate limit
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100))

    // Query paths for specific hostname
    const dataQuery = `
      SELECT 
        ${PATH_EXPR} as path,
        count() as credential_count
      FROM credentials c
      WHERE ${HOSTNAME_EXPR} = {hostname:String}
      GROUP BY ${PATH_EXPR}
      ORDER BY credential_count DESC
      LIMIT {queryLimit:UInt32}
    `

    const data = (await executeClickHouseQuery(dataQuery, { 
      hostname: hostname.trim(),
      queryLimit: safeLimit 
    })) as any[]

    // Get total paths count
    const countQuery = `
      SELECT uniq(${PATH_EXPR}) as total
      FROM credentials c
      WHERE ${HOSTNAME_EXPR} = {hostname:String}
    `
    const countResult = (await executeClickHouseQuery(countQuery, { hostname: hostname.trim() })) as any[]
    const totalPaths = Number(countResult[0]?.total || 0)

    return NextResponse.json({
      success: true,
      hostname,
      paths: data.map((row: any) => ({
        path: row.path || '/',
        credentialCount: Number(row.credential_count || 0),
      })),
      total: totalPaths,
      hasMore: totalPaths > safeLimit,
    })
  } catch (error) {
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
