/**
 * Search API v1 - Credentials Search
 * 
 * POST /api/v1/search/credentials
 * Search credentials by email, username, or password
 * 
 * Available for all API key roles (admin & analyst)
 */

import { NextRequest, NextResponse } from "next/server"
import { withApiKeyAuth, addRateLimitHeaders, logApiRequest } from "@/lib/api-key-auth"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"

export const dynamic = 'force-dynamic'

interface SearchCredentialsRequest {
  query: string
  type: 'email' | 'username' | 'password' | 'any'
  page?: number
  limit?: number
  includePasswords?: boolean // Include full passwords in response (admin keys always get this)
  maskPasswords?: boolean // Deprecated: use includePasswords instead
}

interface CredentialResult {
  deviceId: string
  deviceName: string
  url: string
  domain: string
  username: string
  passwordMasked: string
  password?: string // Only included when includePasswords=true
  browser: string
  country?: string
  uploadDate: string
  hostInfo?: {
    os?: string
    ipAddress?: string
    machineUsername?: string
    cpu?: string
    ram?: string
    gpu?: string
    hwid?: string
    antivirus?: string
    stealerType?: string
    logDate?: string
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
    const body: SearchCredentialsRequest = await request.json()
    const { query, type = 'any', page = 1, limit = 50, includePasswords = false, maskPasswords } = body
    // includePasswords takes precedence; support legacy maskPasswords (inverted logic)
    const showFullPasswords = includePasswords || (maskPasswords === false)

    // Validate input
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: "Query is required", code: "INVALID_REQUEST" },
        { status: 400 }
      )
    }

    if (query.length < 3) {
      return NextResponse.json(
        { success: false, error: "Query must be at least 3 characters", code: "QUERY_TOO_SHORT" },
        { status: 400 }
      )
    }

    if (query.length > 500) {
      return NextResponse.json(
        { success: false, error: "Query must be 500 characters or less", code: "QUERY_TOO_LONG" },
        { status: 400 }
      )
    }

    // Validate pagination
    const pageNum = Math.max(1, Math.floor(Number(page)) || 1)
    const limitNum = Math.min(100, Math.max(1, Math.floor(Number(limit)) || 50))
    const offset = (pageNum - 1) * limitNum

    // Build search query based on type
    const searchPattern = `%${query}%`
    let whereClause = ''
    let countWhereClause = ''

    switch (type) {
      case 'email':
        whereClause = `WHERE (c.username ilike {searchPattern:String} AND c.username LIKE '%@%' AND c.username != '')`
        countWhereClause = whereClause
        break
      case 'username':
        whereClause = `WHERE c.username ilike {searchPattern:String}`
        countWhereClause = whereClause
        break
      case 'password':
        // Security: Only allow exact match for password searches (not pattern)
        whereClause = `WHERE c.password = {exactQuery:String}`
        countWhereClause = whereClause
        break
      case 'any':
      default:
        whereClause = `WHERE (c.username ilike {searchPattern:String} OR c.url ilike {searchPattern:String})`
        countWhereClause = whereClause
        break
    }

    // Get total count
    const countQuery = `
      SELECT count() as total
      FROM credentials c
      ${countWhereClause}
    `
    
    const countResult = await executeClickHouseQuery(
      countQuery,
      type === 'password' ? { exactQuery: query } : { searchPattern }
    ) as any[]

    const total = Number(countResult[0]?.total) || 0

    // Get results with device and system info
    const searchQuery = `
      SELECT 
        c.device_id AS device_id,
        d.device_name AS device_name,
        c.url AS url,
        c.domain AS domain,
        c.username AS username,
        c.password AS password,
        c.browser AS browser,
        d.upload_date AS upload_date,
        si.country AS country,
        si.computer_name AS computer_name,
        si.os AS os,
        si.ip_address AS ip_address,
        si.username AS machine_username,
        si.cpu AS cpu,
        si.ram AS ram,
        si.gpu AS gpu,
        si.hwid AS hwid,
        si.antivirus AS antivirus,
        si.stealer_type AS stealer_type,
        si.log_date AS log_date
      FROM credentials c
      JOIN devices d ON c.device_id = d.device_id
      LEFT JOIN systeminformation si ON c.device_id = si.device_id
      ${whereClause}
      ORDER BY d.upload_date DESC, c.username
      LIMIT {limitNum:UInt32} OFFSET {offset:UInt32}
    `

    const results = await executeClickHouseQuery(
      searchQuery,
      {
        ...(type === 'password' ? { exactQuery: query } : { searchPattern }),
        limitNum,
        offset
      }
    ) as any[]

    // Format results
    const credentials: CredentialResult[] = results.map((row: any) => {
      const result: CredentialResult = {
        deviceId: row.device_id,
        deviceName: row.computer_name || row.device_name || '',
        url: row.url || '',
        domain: row.domain || '',
        username: row.username || '',
        passwordMasked: maskPassword(row.password),
        ...(showFullPasswords ? { password: row.password || '' } : {}),
        browser: row.browser || 'Unknown',
        country: row.country || undefined,
        uploadDate: row.upload_date,
        hostInfo: {
          os: cleanValue(row.os),
          ipAddress: cleanValue(row.ip_address),
          machineUsername: cleanValue(row.machine_username),
          cpu: cleanValue(row.cpu),
          ram: cleanValue(row.ram),
          gpu: cleanValue(row.gpu),
          hwid: cleanValue(row.hwid),
          antivirus: cleanValue(row.antivirus),
          stealerType: row.stealer_type || undefined,
          logDate: row.log_date || undefined,
        },
      }
      
      return result
    })

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
        }
      },
      meta: {
        query,
        type,
        searchedAt: new Date().toISOString()
      }
    })

    // Add rate limit headers
    addRateLimitHeaders(response, payload)

    // Log API request
    const duration = Date.now() - startTime
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: '/api/v1/search/credentials',
      method: 'POST',
      statusCode: 200,
      duration,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return response
  } catch (error) {
    console.error("Search credentials error:", error)
    
    // Log error
    const duration = Date.now() - startTime
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: '/api/v1/search/credentials',
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

/**
 * Mask password for display (show first and last char, mask middle)
 */
function maskPassword(password: string | null | undefined): string {
  if (!password) return '***'
  if (password.length <= 2) return '***'
  if (password.length <= 4) return password[0] + '**' + password[password.length - 1]
  return password[0] + '*'.repeat(Math.min(password.length - 2, 8)) + password[password.length - 1]
}

/**
 * Clean a string value: return undefined if it contains broken encoding (mostly ? characters)
 */
function cleanValue(value: string | null | undefined): string | undefined {
  if (!value || value.trim() === '') return undefined
  // If more than 50% of the string is ? characters, consider it broken encoding
  const questionMarks = (value.match(/\?/g) || []).length
  if (questionMarks > value.length * 0.5) return undefined
  return value
}
