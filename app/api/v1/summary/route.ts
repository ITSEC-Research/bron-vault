/**
 * Summary API v1 - Dashboard Summary Endpoint
 *
 * GET /api/v1/summary
 * GET /api/v1/summary?startDate=2024-01-01&endDate=2024-12-31
 *
 * Returns dashboard summary data including:
 * - Overall statistics (devices, credentials, files, domains, urls)
 * - Top 50 TLDs
 * - Country statistics with heatmap data
 *
 * Excludes: Top passwords, browser analysis, software analysis
 *
 * Available for all API key roles (admin & analyst)
 */

import { NextRequest, NextResponse } from "next/server"
import { withApiKeyAuth, addRateLimitHeaders, logApiRequest } from "@/lib/api-key-auth"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"
import { normalizeCountryToCode } from "@/lib/system-information-parser/country-mapping"
import { getCountryName, createAlpha2ToAlpha3Map } from "@/lib/country-iso-utils"
import {
  parseDateFilterFromRequest,
  buildDeviceDateFilter,
  buildSystemInfoDateFilter,
} from "@/lib/date-filter-utils"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // Validate API key
  const auth = await withApiKeyAuth(request)
  if (auth.response) {
    return auth.response
  }

  const { payload } = auth

  try {
    // Parse date filter params
    const searchParams = request.nextUrl.searchParams
    const dateFilter = parseDateFilterFromRequest(searchParams)

    // Build date filter WHERE clause
    const { whereClause: deviceDateFilter, hasFilter } = buildDeviceDateFilter(dateFilter)

    // Build device filter for TLDs (need device_id subquery for date filtering)
    let tldDeviceFilter = ""
    let tldDeviceFilterParams: Record<string, unknown> = {}
    let deviceIds: string[] = []

    if (hasFilter) {
      const { whereClause: systemInfoDateFilter } = buildSystemInfoDateFilter(dateFilter)

      // Get device_ids that match date range from both tables
      const [deviceIdsFromDevices, deviceIdsFromSystemInfo] = await Promise.all([
        executeClickHouseQuery(
          `SELECT DISTINCT device_id FROM devices ${deviceDateFilter}`
        ) as Promise<any[]>,
        executeClickHouseQuery(
          `SELECT DISTINCT device_id FROM systeminformation ${systemInfoDateFilter}`
        ) as Promise<any[]>,
      ])

      // Combine and deduplicate
      const allDeviceIds = new Set<string>()
      deviceIdsFromDevices.forEach((r: any) => {
        if (r.device_id) allDeviceIds.add(String(r.device_id))
      })
      deviceIdsFromSystemInfo.forEach((r: any) => {
        if (r.device_id) allDeviceIds.add(String(r.device_id))
      })

      deviceIds = Array.from(allDeviceIds)

      if (deviceIds.length === 0) {
        // No devices match the date range - return empty results
        const duration = Date.now() - startTime
        logApiRequest({
          apiKeyId: payload.keyId,
          endpoint: "/api/v1/summary",
          method: "GET",
          statusCode: 200,
          duration,
          ipAddress:
            request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            undefined,
          userAgent: request.headers.get("user-agent") || undefined,
        })

        const response = NextResponse.json({
          success: true,
          stats: {
            totalDevices: 0,
            uniqueDeviceNames: 0,
            duplicateDeviceNames: 0,
            totalFiles: 0,
            totalCredentials: 0,
            totalDomains: 0,
            totalUrls: 0,
          },
          topTLDs: [],
          countryStats: {
            summary: {
              totalDevices: 0,
              totalCredentials: 0,
              affectedCountries: 0,
            },
            topCountries: [],
            countries: [],
          },
        })

        addRateLimitHeaders(response, payload)
        return response
      }

      // SECURITY: Use parameterized array for ClickHouse IN clause
      tldDeviceFilter = `AND device_id IN {filterDeviceIds:Array(String)}`
      tldDeviceFilterParams = { filterDeviceIds: deviceIds }
    }

    // Run all queries in parallel
    const queryResults = await Promise.allSettled([
      // 1. Device stats (count + unique)
      executeClickHouseQuery(`
        SELECT 
          count() as total_devices,
          uniq(device_name_hash) as unique_devices
        FROM devices
        ${deviceDateFilter || ""}
      `),

      // 2. File count
      executeClickHouseQuery(
        hasFilter
          ? `SELECT count() as count FROM files WHERE is_directory = 0 AND device_id IN {filterDeviceIds:Array(String)}`
          : "SELECT count() as count FROM files WHERE is_directory = 0",
        hasFilter && deviceIds.length > 0
          ? { filterDeviceIds: deviceIds }
          : {}
      ),

      // 3. Aggregated stats (credentials, domains, urls)
      executeClickHouseQuery(`
        SELECT 
          sum(total_credentials) as total_credentials,
          sum(total_domains) as total_domains,
          sum(total_urls) as total_urls
        FROM devices
        ${deviceDateFilter || ""}
      `),

      // 4. Top 50 TLDs
      executeClickHouseQuery(
        `
        SELECT 
          tld,
          count() as count,
          uniq(device_id) as affected_devices
        FROM credentials 
        WHERE tld IS NOT NULL 
          AND tld != ''
          AND tld NOT LIKE '%localhost%'
          AND tld NOT LIKE '%127.0.0.1%'
          AND tld NOT LIKE '%192.168%'
          AND tld NOT LIKE '%10.%'
          ${tldDeviceFilter}
        GROUP BY tld 
        ORDER BY count DESC, affected_devices DESC
        LIMIT 50
      `,
        tldDeviceFilterParams
      ),

      // 5. Country stats
      executeClickHouseQuery(
        hasFilter
          ? `
          SELECT 
            si.country,
            uniq(si.device_id) as total_devices,
            sum(d.total_credentials) as total_credentials
          FROM systeminformation si
          INNER JOIN devices d ON si.device_id = d.device_id
          WHERE si.country IS NOT NULL 
            AND si.country != ''
            AND length(trimBoth(si.country)) > 0
            AND si.device_id IN {filterDeviceIds:Array(String)}
          GROUP BY si.country
          ORDER BY total_devices DESC
        `
          : `
          SELECT 
            si.country,
            uniq(si.device_id) as total_devices,
            sum(d.total_credentials) as total_credentials
          FROM systeminformation si
          INNER JOIN devices d ON si.device_id = d.device_id
          WHERE si.country IS NOT NULL 
            AND si.country != ''
            AND length(trimBoth(si.country)) > 0
          GROUP BY si.country
          ORDER BY total_devices DESC
        `,
        hasFilter && deviceIds.length > 0
          ? { filterDeviceIds: deviceIds }
          : {}
      ),
    ])

    // Extract results with fallbacks
    const deviceStatsResult =
      queryResults[0].status === "fulfilled"
        ? (queryResults[0].value as any[])
        : []
    const fileCountResult =
      queryResults[1].status === "fulfilled"
        ? (queryResults[1].value as any[])
        : []
    const aggregatedStatsResult =
      queryResults[2].status === "fulfilled"
        ? (queryResults[2].value as any[])
        : []
    const topTldsResult =
      queryResults[3].status === "fulfilled"
        ? (queryResults[3].value as any[])
        : []
    const countryStatsResult =
      queryResults[4].status === "fulfilled"
        ? (queryResults[4].value as any[])
        : []

    // Log any failures
    queryResults.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`Summary API query ${index} failed:`, result.reason)
      }
    })

    // Build stats
    const deviceStats = deviceStatsResult[0] || {}
    const totalDevices = Number(deviceStats.total_devices) || 0
    const uniqueDeviceNames = Number(deviceStats.unique_devices) || 0
    const duplicateDeviceNames = Math.max(0, totalDevices - uniqueDeviceNames)

    const fileStats = fileCountResult[0] || {}
    const totalFiles = Number(fileStats.count) || 0

    const aggStats = aggregatedStatsResult[0] || {}

    // Build top TLDs
    const topTLDs = (topTldsResult as any[]).map((row: any) => ({
      tld: row.tld,
      count: Number(row.count) || 0,
      affected_devices: Number(row.affected_devices) || 0,
    }))

    // Process country stats
    const processedCountries: Array<{
      country: string
      countryName: string
      totalDevices: number
      totalCredentials: number
    }> = []
    const countryCodeSet = new Set<string>()

    for (const row of countryStatsResult as any[]) {
      const rawCountry = row.country
      if (!rawCountry) continue

      const alpha2Code = normalizeCountryToCode(rawCountry)
      if (!alpha2Code) continue

      if (countryCodeSet.has(alpha2Code)) {
        const existing = processedCountries.find((s) => s.country === alpha2Code)
        if (existing) {
          existing.totalDevices += Number(row.total_devices) || 0
          existing.totalCredentials += Number(row.total_credentials) || 0
        }
        continue
      }

      countryCodeSet.add(alpha2Code)
      const countryName = getCountryName(alpha2Code) || alpha2Code

      processedCountries.push({
        country: alpha2Code,
        countryName,
        totalDevices: Number(row.total_devices) || 0,
        totalCredentials: Number(row.total_credentials) || 0,
      })
    }

    const countrySummary = {
      totalDevices: processedCountries.reduce(
        (sum, s) => sum + s.totalDevices,
        0
      ),
      totalCredentials: processedCountries.reduce(
        (sum, s) => sum + s.totalCredentials,
        0
      ),
      affectedCountries: processedCountries.length,
    }

    const topCountries = [...processedCountries]
      .sort((a, b) => b.totalDevices - a.totalDevices)
      .slice(0, 10)
      .map((stat, index) => ({
        rank: index + 1,
        country: stat.country,
        countryName: stat.countryName,
        totalDevices: stat.totalDevices,
        totalCredentials: stat.totalCredentials,
      }))

    const alpha2Codes = processedCountries.map((s) => s.country)
    const alpha2ToAlpha3Map = createAlpha2ToAlpha3Map(alpha2Codes)

    const result = {
      success: true,
      stats: {
        totalDevices,
        uniqueDeviceNames,
        duplicateDeviceNames,
        totalFiles,
        totalCredentials: Number(aggStats.total_credentials) || 0,
        totalDomains: Number(aggStats.total_domains) || 0,
        totalUrls: Number(aggStats.total_urls) || 0,
      },
      topTLDs,
      countryStats: {
        summary: countrySummary,
        topCountries,
        countries: processedCountries,
        alpha2ToAlpha3Map,
      },
    }

    const duration = Date.now() - startTime
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: "/api/v1/summary",
      method: "GET",
      statusCode: 200,
      duration,
      ipAddress:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    })

    const response = NextResponse.json(result)
    addRateLimitHeaders(response, payload)
    return response
  } catch (error) {
    console.error("Summary API error:", error)

    const duration = Date.now() - startTime
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: "/api/v1/summary",
      method: "GET",
      statusCode: 500,
      duration,
      ipAddress:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    })

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load summary data",
        details:
          error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
