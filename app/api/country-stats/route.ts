import { NextRequest, NextResponse } from "next/server"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"
import { validateRequest } from "@/lib/auth"
import { normalizeCountryToCode } from "@/lib/system-information-parser/country-mapping"
import { getCountryName, createAlpha2ToAlpha3Map } from "@/lib/country-iso-utils"

export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Query ClickHouse untuk aggregasi devices dan credentials per country
    // Join systeminformation dengan devices untuk mendapatkan total credentials
    const countryStatsResult = (await executeClickHouseQuery(`
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
    `)) as any[]

    // Process dan normalize country codes
    const processedStats: Array<{
      country: string          // Alpha-2 code
      countryName: string      // Full country name
      totalDevices: number
      totalCredentials: number
    }> = []

    const countryCodeSet = new Set<string>()

    for (const row of countryStatsResult) {
      const rawCountry = row.country
      if (!rawCountry) continue

      // Normalize ke Alpha-2 code
      const alpha2Code = normalizeCountryToCode(rawCountry)
      if (!alpha2Code) {
        console.warn(`Could not normalize country: ${rawCountry}`)
        continue
      }

      // Skip jika sudah diproses (handle duplicates)
      if (countryCodeSet.has(alpha2Code)) {
        // Merge dengan existing entry
        const existing = processedStats.find(s => s.country === alpha2Code)
        if (existing) {
          existing.totalDevices += Number(row.total_devices) || 0
          existing.totalCredentials += Number(row.total_credentials) || 0
        }
        continue
      }

      countryCodeSet.add(alpha2Code)

      // Get country name
      const countryName = getCountryName(alpha2Code) || alpha2Code

      processedStats.push({
        country: alpha2Code,
        countryName,
        totalDevices: Number(row.total_devices) || 0,
        totalCredentials: Number(row.total_credentials) || 0,
      })
    }

    // Calculate summary
    // NOTE: These totals are ONLY for devices that have country information.
    // They may differ from the main dashboard stats which include ALL devices.
    // This is because not all devices have country data in systeminformation table.
    const totalDevices = processedStats.reduce((sum, stat) => sum + stat.totalDevices, 0)
    const totalCredentials = processedStats.reduce((sum, stat) => sum + stat.totalCredentials, 0)
    const affectedCountries = processedStats.length

    // Get top 5 countries by devices
    const topCountries = [...processedStats]
      .sort((a, b) => b.totalDevices - a.totalDevices)
      .slice(0, 5)
      .map((stat, index) => ({
        rank: index + 1,
        country: stat.country,
        countryName: stat.countryName,
        totalDevices: stat.totalDevices,
        totalCredentials: stat.totalCredentials,
      }))

    // Create Alpha-2 to Alpha-3 mapping untuk fast lookup di frontend
    const alpha2Codes = processedStats.map(s => s.country)
    const alpha2ToAlpha3Map = createAlpha2ToAlpha3Map(alpha2Codes)

    return NextResponse.json({
      success: true,
      countryStats: processedStats,
      summary: {
        totalDevices,
        totalCredentials,
        affectedCountries,
      },
      topCountries,
      alpha2ToAlpha3Map, // Untuk mapping di frontend
    })
  } catch (error) {
    console.error("Error loading country stats:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load country statistics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
