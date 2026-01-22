/**
 * Search API v1 - Domain Search
 * 
 * POST /api/v1/search/domain
 * Search credentials by domain (supports subdomain matching)
 * 
 * Available for all API key roles (admin & analyst)
 */

import { NextRequest, NextResponse } from "next/server"
import { withApiKeyAuth, addRateLimitHeaders, logApiRequest } from "@/lib/api-key-auth"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"

export const dynamic = 'force-dynamic'

interface SearchDomainRequest {
  domain: string
  includeSubdomains?: boolean // Default true
  page?: number
  limit?: number
  maskPasswords?: boolean // Default false - show plain passwords
}

interface DomainSearchResult {
  deviceId: string
  deviceName: string
  url: string
  domain: string
  username: string
  password: string // Always included
  browser: string
  country?: string
  uploadDate: string
}

/**
 * Build WHERE clause for domain matching (ClickHouse)
 */
function buildDomainWhereClause(targetDomain: string, includeSubdomains: boolean): { whereClause: string; params: Record<string, string> } {
  if (includeSubdomains) {
    // Match exact domain and subdomains
    const whereClause = `(
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
  } else {
    // Exact domain match only
    const whereClause = `(
      domain = {domain:String} OR
      url ilike {pattern1:String} OR
      url ilike {pattern2:String}
    )`
    
    return {
      whereClause,
      params: {
        domain: targetDomain,
        pattern1: `%://${targetDomain}/%`,
        pattern2: `%://${targetDomain}:%`
      }
    }
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  // Validate API key
  const auth = await withApiKeyAuth(request)
  if (auth.response) {
    return auth.response
  }
  
  const { payload } = auth

  try {
    const body: SearchDomainRequest = await request.json()
    const { 
      domain, 
      includeSubdomains = true, 
      page = 1, 
      limit = 50, 
      maskPasswords = false 
    } = body

    // Validate input
    if (!domain || typeof domain !== 'string') {
      return NextResponse.json(
        { success: false, error: "Domain is required", code: "INVALID_REQUEST" },
        { status: 400 }
      )
    }

    // Normalize domain
    let normalizedDomain = domain.trim().toLowerCase()
    normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '')
    normalizedDomain = normalizedDomain.replace(/^www\./, '')
    normalizedDomain = normalizedDomain.replace(/\/$/, '')
    normalizedDomain = normalizedDomain.split('/')[0].split(':')[0]

    if (normalizedDomain.length < 3) {
      return NextResponse.json(
        { success: false, error: "Domain must be at least 3 characters", code: "DOMAIN_TOO_SHORT" },
        { status: 400 }
      )
    }

    // Validate pagination
    const pageNum = Math.max(1, Math.floor(Number(page)) || 1)
    const limitNum = Math.min(100, Math.max(1, Math.floor(Number(limit)) || 50))
    const offset = (pageNum - 1) * limitNum

    // Build domain WHERE clause
    const { whereClause, params } = buildDomainWhereClause(normalizedDomain, includeSubdomains)

    // Get total count
    const countResult = await executeClickHouseQuery(
      `SELECT count() as total FROM credentials WHERE ${whereClause}`,
      params
    ) as any[]

    const total = Number(countResult[0]?.total) || 0

    // Get unique devices affected
    const deviceCountResult = await executeClickHouseQuery(
      `SELECT uniq(device_id) as unique_devices FROM credentials WHERE ${whereClause}`,
      params
    ) as any[]

    const uniqueDevices = Number(deviceCountResult[0]?.unique_devices) || 0

    // Get results with device info
    const searchQuery = `
      SELECT 
        c.device_id,
        d.device_name,
        c.url,
        c.domain,
        c.username,
        c.password,
        c.browser,
        d.upload_date,
        si.country
      FROM credentials c
      JOIN devices d ON c.device_id = d.device_id
      LEFT JOIN systeminformation si ON c.device_id = si.device_id
      WHERE ${whereClause}
      ORDER BY d.upload_date DESC, c.domain, c.username
      LIMIT {limitNum:UInt32} OFFSET {offset:UInt32}
    `

    const results = await executeClickHouseQuery(
      searchQuery,
      { ...params, limitNum, offset }
    ) as any[]

    // Format results
    const credentials: DomainSearchResult[] = results.map((row: any) => {
      const result: DomainSearchResult = {
        deviceId: row.device_id,
        deviceName: row.device_name,
        url: row.url || '',
        domain: row.domain || '',
        username: row.username || '',
        password: maskPasswords ? maskPassword(row.password) : (row.password || ''),
        browser: row.browser || 'Unknown',
        country: row.country || undefined,
        uploadDate: row.upload_date,
      }
      
      return result
    })

    // Get subdomain breakdown
    const subdomainStats = await executeClickHouseQuery(
      `SELECT 
        domain,
        count() as count
      FROM credentials 
      WHERE ${whereClause}
      GROUP BY domain
      ORDER BY count DESC
      LIMIT 20`,
      params
    ) as any[]

    const response = NextResponse.json({
      success: true,
      data: {
        credentials,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasMore: pageNum * limitNum < total
        },
        summary: {
          totalCredentials: total,
          uniqueDevices,
          subdomains: subdomainStats.map((s: any) => ({
            domain: s.domain,
            count: Number(s.count) || 0
          }))
        }
      },
      meta: {
        searchedDomain: normalizedDomain,
        includeSubdomains,
        searchedAt: new Date().toISOString()
      }
    })

    // Add rate limit headers
    addRateLimitHeaders(response, payload)

    // Log API request
    const duration = Date.now() - startTime
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: '/api/v1/search/domain',
      method: 'POST',
      statusCode: 200,
      duration,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return response
  } catch (error) {
    console.error("Domain search error:", error)
    
    const duration = Date.now() - startTime
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: '/api/v1/search/domain',
      method: 'POST',
      statusCode: 500,
      duration,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return NextResponse.json(
      {
        success: false,
        error: "Search failed",
        code: "SEARCH_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

function maskPassword(password: string | null | undefined): string {
  if (!password) return '***'
  if (password.length <= 2) return '***'
  if (password.length <= 4) return password[0] + '**' + password[password.length - 1]
  return password[0] + '*'.repeat(Math.min(password.length - 2, 8)) + password[password.length - 1]
}
