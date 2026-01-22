/**
 * Quick Lookup API v1 - Unified Lookup Endpoint
 * 
 * GET /api/v1/lookup?email=john@example.com
 * GET /api/v1/lookup?domain=example.com
 * 
 * Quick check if email/domain exists in the database
 * Returns summary without full credentials (fast endpoint)
 * 
 * Available for all API key roles (admin & analyst)
 */

import { NextRequest, NextResponse } from "next/server"
import { withApiKeyAuth, addRateLimitHeaders, logApiRequest } from "@/lib/api-key-auth"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  // Validate API key
  const auth = await withApiKeyAuth(request)
  if (auth.response) {
    return auth.response
  }
  
  const { payload } = auth

  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const domain = searchParams.get('domain')

    // Validate that exactly one parameter is provided
    if (!email && !domain) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Missing parameter. Use ?email= or ?domain=", 
          code: "MISSING_PARAMETER",
          usage: {
            email: "/api/v1/lookup?email=john@example.com",
            domain: "/api/v1/lookup?domain=example.com"
          }
        },
        { status: 400 }
      )
    }

    if (email && domain) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Only one parameter allowed. Use either ?email= or ?domain=", 
          code: "MULTIPLE_PARAMETERS" 
        },
        { status: 400 }
      )
    }

    // Route to appropriate lookup
    if (email) {
      return await lookupEmail(email, payload, startTime, request)
    } else {
      return await lookupDomain(domain!, payload, startTime, request)
    }
  } catch (error) {
    console.error("Lookup error:", error)
    
    const duration = Date.now() - startTime
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: '/api/v1/lookup',
      method: 'GET',
      statusCode: 500,
      duration,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return NextResponse.json(
      {
        success: false,
        error: "Lookup failed",
        code: "LOOKUP_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

/**
 * Email Lookup
 */
async function lookupEmail(
  email: string, 
  payload: any, 
  startTime: number, 
  request: NextRequest
): Promise<NextResponse> {
  // Validate email
  if (email.length < 3) {
    return NextResponse.json(
      { success: false, error: "Email must be at least 3 characters", code: "INVALID_EMAIL" },
      { status: 400 }
    )
  }

  // Quick lookup - check if email exists
  const searchPattern = `%${email}%`
  
  const result = await executeClickHouseQuery(
    `SELECT 
      count() as total_matches,
      uniq(device_id) as unique_devices,
      min(d.upload_date) as first_seen,
      max(d.upload_date) as last_seen
    FROM credentials c
    JOIN devices d ON c.device_id = d.device_id
    WHERE c.username ilike {searchPattern:String}`,
    { searchPattern }
  ) as any[]

  const stats = result[0] || {}
  const totalMatches = Number(stats.total_matches) || 0
  const uniqueDevices = Number(stats.unique_devices) || 0

  // Get top domains for this email
  let topDomains: any[] = []
  if (totalMatches > 0) {
    topDomains = await executeClickHouseQuery(
      `SELECT 
        domain,
        count() as count
      FROM credentials
      WHERE username ilike {searchPattern:String}
        AND domain IS NOT NULL 
        AND domain != ''
      GROUP BY domain
      ORDER BY count DESC
      LIMIT 5`,
      { searchPattern }
    ) as any[]
  }

  // Get countries affected
  let countries: any[] = []
  if (totalMatches > 0) {
    countries = await executeClickHouseQuery(
      `SELECT 
        si.country,
        count() as count
      FROM credentials c
      JOIN systeminformation si ON c.device_id = si.device_id
      WHERE c.username ilike {searchPattern:String}
        AND si.country IS NOT NULL 
        AND si.country != ''
      GROUP BY si.country
      ORDER BY count DESC
      LIMIT 5`,
      { searchPattern }
    ) as any[]
  }

  const found = totalMatches > 0

  const response = NextResponse.json({
    success: true,
    data: {
      type: 'email',
      query: email,
      found,
      summary: found ? {
        totalCredentials: totalMatches,
        uniqueDevices,
        firstSeen: stats.first_seen || null,
        lastSeen: stats.last_seen || null,
        topDomains: topDomains.map((d: any) => ({
          domain: d.domain,
          count: Number(d.count) || 0
        })),
        countries: countries.map((c: any) => ({
          country: c.country,
          count: Number(c.count) || 0
        }))
      } : null
    },
    meta: {
      checkedAt: new Date().toISOString()
    }
  })

  // Add rate limit headers
  addRateLimitHeaders(response, payload)

  // Log API request
  const duration = Date.now() - startTime
  logApiRequest({
    apiKeyId: payload.keyId,
    endpoint: `/api/v1/lookup?email=${email}`,
    method: 'GET',
    statusCode: 200,
    duration,
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
    userAgent: request.headers.get('user-agent') || undefined
  })

  return response
}

/**
 * Domain Lookup
 */
async function lookupDomain(
  domain: string, 
  payload: any, 
  startTime: number, 
  request: NextRequest
): Promise<NextResponse> {
  // Normalize domain
  let normalizedDomain = domain.trim().toLowerCase()
  normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '')
  normalizedDomain = normalizedDomain.replace(/^www\./, '')
  normalizedDomain = normalizedDomain.replace(/\/$/, '')
  normalizedDomain = normalizedDomain.split('/')[0].split(':')[0]
  
  // Validate domain
  if (normalizedDomain.length < 3) {
    return NextResponse.json(
      { success: false, error: "Domain must be at least 3 characters", code: "INVALID_DOMAIN" },
      { status: 400 }
    )
  }

  // Build WHERE clause for domain matching
  const whereClause = `(
    domain = {domain:String} OR 
    domain ilike concat('%.', {domain:String}) OR
    url ilike {pattern1:String} OR
    url ilike {pattern2:String}
  )`
  
  const queryParams = {
    domain: normalizedDomain,
    pattern1: `%://${normalizedDomain}/%`,
    pattern2: `%://%.${normalizedDomain}/%`
  }

  // Quick lookup stats
  const result = await executeClickHouseQuery(
    `SELECT 
      count() as total_matches,
      uniq(device_id) as unique_devices,
      min(d.upload_date) as first_seen,
      max(d.upload_date) as last_seen
    FROM credentials c
    JOIN devices d ON c.device_id = d.device_id
    WHERE ${whereClause}`,
    queryParams
  ) as any[]

  const stats = result[0] || {}
  const totalMatches = Number(stats.total_matches) || 0
  const uniqueDevices = Number(stats.unique_devices) || 0

  // Get subdomains breakdown
  let subdomains: any[] = []
  if (totalMatches > 0) {
    subdomains = await executeClickHouseQuery(
      `SELECT 
        domain,
        count() as count
      FROM credentials
      WHERE ${whereClause}
        AND domain IS NOT NULL 
        AND domain != ''
      GROUP BY domain
      ORDER BY count DESC
      LIMIT 10`,
      queryParams
    ) as any[]
  }

  // Get countries affected
  let countries: any[] = []
  if (totalMatches > 0) {
    countries = await executeClickHouseQuery(
      `SELECT 
        si.country,
        count() as count
      FROM credentials c
      JOIN systeminformation si ON c.device_id = si.device_id
      WHERE ${whereClause}
        AND si.country IS NOT NULL 
        AND si.country != ''
      GROUP BY si.country
      ORDER BY count DESC
      LIMIT 10`,
      queryParams
    ) as any[]
  }

  // Get unique usernames count (for privacy, don't return actual usernames)
  let uniqueUsernames = 0
  if (totalMatches > 0) {
    const usernameResult = await executeClickHouseQuery(
      `SELECT uniq(username) as unique_usernames
      FROM credentials
      WHERE ${whereClause}`,
      queryParams
    ) as any[]
    uniqueUsernames = Number(usernameResult[0]?.unique_usernames) || 0
  }

  const found = totalMatches > 0

  const response = NextResponse.json({
    success: true,
    data: {
      type: 'domain',
      query: normalizedDomain,
      found,
      summary: found ? {
        totalCredentials: totalMatches,
        uniqueDevices,
        uniqueUsernames,
        firstSeen: stats.first_seen || null,
        lastSeen: stats.last_seen || null,
        subdomains: subdomains.map((s: any) => ({
          domain: s.domain,
          count: Number(s.count) || 0
        })),
        countries: countries.map((c: any) => ({
          country: c.country,
          count: Number(c.count) || 0
        }))
      } : null
    },
    meta: {
      checkedAt: new Date().toISOString()
    }
  })

  // Add rate limit headers
  addRateLimitHeaders(response, payload)

  // Log API request
  const duration = Date.now() - startTime
  logApiRequest({
    apiKeyId: payload.keyId,
    endpoint: `/api/v1/lookup?domain=${domain}`,
    method: 'GET',
    statusCode: 200,
    duration,
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
    userAgent: request.headers.get('user-agent') || undefined
  })

  return response
}
