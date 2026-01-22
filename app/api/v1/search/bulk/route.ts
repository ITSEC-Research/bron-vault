/**
 * Bulk Search API v1
 * 
 * POST /api/v1/search/bulk
 * Search multiple emails or domains at once
 * 
 * Available for all API key roles (admin & analyst)
 */

import { NextRequest, NextResponse } from "next/server"
import { withApiKeyAuth, addRateLimitHeaders, logApiRequest } from "@/lib/api-key-auth"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"

export const dynamic = 'force-dynamic'

interface BulkSearchRequest {
  items: string[]
  type: 'email' | 'domain'
  summaryOnly?: boolean // If true, only return found/not found status
}

interface BulkSearchResult {
  item: string
  found: boolean
  count?: number
  uniqueDevices?: number
  firstSeen?: string
  lastSeen?: string
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
    const body: BulkSearchRequest = await request.json()
    const { items, type, summaryOnly = true } = body

    // Validate input
    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, error: "Items array is required", code: "INVALID_REQUEST" },
        { status: 400 }
      )
    }

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Items array cannot be empty", code: "INVALID_REQUEST" },
        { status: 400 }
      )
    }

    // Limit bulk search to 100 items per request
    if (items.length > 100) {
      return NextResponse.json(
        { success: false, error: "Maximum 100 items per request", code: "TOO_MANY_ITEMS" },
        { status: 400 }
      )
    }

    if (type !== 'email' && type !== 'domain') {
      return NextResponse.json(
        { success: false, error: "Type must be 'email' or 'domain'", code: "INVALID_TYPE" },
        { status: 400 }
      )
    }

    // Deduplicate and normalize items
    const uniqueItems = [...new Set(items.map(item => item.trim().toLowerCase()))]
      .filter(item => item.length >= 3)

    const results: BulkSearchResult[] = []

    if (type === 'email') {
      // Batch search for emails
      for (const email of uniqueItems) {
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
        const count = Number(stats.total_matches) || 0

        results.push({
          item: email,
          found: count > 0,
          ...(summaryOnly ? {} : {
            count,
            uniqueDevices: Number(stats.unique_devices) || 0,
            firstSeen: stats.first_seen || undefined,
            lastSeen: stats.last_seen || undefined
          })
        })
      }
    } else {
      // Batch search for domains
      for (const domain of uniqueItems) {
        // Normalize domain
        let normalizedDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '')
        normalizedDomain = normalizedDomain.replace(/\/$/, '').split('/')[0].split(':')[0]

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
        const count = Number(stats.total_matches) || 0

        results.push({
          item: domain,
          found: count > 0,
          ...(summaryOnly ? {} : {
            count,
            uniqueDevices: Number(stats.unique_devices) || 0,
            firstSeen: stats.first_seen || undefined,
            lastSeen: stats.last_seen || undefined
          })
        })
      }
    }

    // Summary stats
    const foundCount = results.filter(r => r.found).length
    const notFoundCount = results.filter(r => !r.found).length

    const response = NextResponse.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          found: foundCount,
          notFound: notFoundCount
        }
      },
      meta: {
        type,
        summaryOnly,
        searchedAt: new Date().toISOString()
      }
    })

    // Add rate limit headers
    addRateLimitHeaders(response, payload)

    // Log API request
    const duration = Date.now() - startTime
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: '/api/v1/search/bulk',
      method: 'POST',
      statusCode: 200,
      duration,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return response
  } catch (error) {
    console.error("Bulk search error:", error)
    
    const duration = Date.now() - startTime
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: '/api/v1/search/bulk',
      method: 'POST',
      statusCode: 500,
      duration,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return NextResponse.json(
      {
        success: false,
        error: "Bulk search failed",
        code: "SEARCH_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
