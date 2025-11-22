import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"

/**
 * Build WHERE clause for domain matching that supports subdomains
 * Matches both domain column and hostname extracted from URL
 * EXISTING FUNCTION - NOT MODIFIED
 */
function buildDomainWhereClause(targetDomain: string): { whereClause: string; params: any[] } {
  // Extract hostname from URL expression (reusable)
  const hostnameExpr = `CASE 
    WHEN c.url LIKE 'http://%' OR c.url LIKE 'https://%' THEN
      LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(REPLACE(c.url, 'http://', ''), 'https://', ''), '/', 1), ':', 1))
    ELSE
      LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(c.url, '/', 1), ':', 1))
  END`
  
  // Match:
  // 1. Exact domain match: domain = 'api.example.com'
  // 2. Subdomain match: domain LIKE '%.api.example.com' (matches subdomain.api.example.com in domain column)
  // 3. Exact hostname match: hostname_from_url = 'api.example.com' (matches when domain column is base domain like 'example.com')
  // 4. Subdomain hostname match: hostname_from_url LIKE '%.api.example.com' (matches v1.api.example.com, etc.)
  const whereClause = `WHERE (
    c.domain = ? OR 
    c.domain LIKE CONCAT('%.', ?) OR
    ${hostnameExpr} = ? OR
    ${hostnameExpr} LIKE CONCAT('%.', ?)
  ) AND c.domain IS NOT NULL`
  
  return {
    whereClause,
    params: [targetDomain, targetDomain, targetDomain, targetDomain]
  }
}

/**
 * Build WHERE clause for keyword search
 * Supports two modes: domain-only (hostname only) or full-url (entire URL)
 * NEW FUNCTION - SEPARATE FROM DOMAIN SEARCH
 */
function buildKeywordWhereClause(keyword: string, mode: 'domain-only' | 'full-url' = 'full-url'): { whereClause: string; params: any[] } {
  if (mode === 'domain-only') {
    // Extract hostname from URL, then search keyword in hostname only
    const hostnameExpr = `CASE 
      WHEN c.url LIKE 'http://%' OR c.url LIKE 'https://%' THEN
        SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(REPLACE(c.url, 'http://', ''), 'https://', ''), '/', 1), ':', 1)
      ELSE
        SUBSTRING_INDEX(SUBSTRING_INDEX(c.url, '/', 1), ':', 1)
    END`
    
    const whereClause = `WHERE ${hostnameExpr} LIKE ? AND c.url IS NOT NULL`
    return {
      whereClause,
      params: [`%${keyword}%`]
    }
  } else {
    // Full URL mode: search keyword in entire URL (current behavior)
    const whereClause = `WHERE c.url LIKE ? AND c.url IS NOT NULL`
    return {
      whereClause,
      params: [`%${keyword}%`]
    }
  }
}

export async function POST(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { targetDomain, timelineGranularity, searchType = 'domain' } = body

    if (!targetDomain || typeof targetDomain !== 'string') {
      return NextResponse.json({ error: "targetDomain is required" }, { status: 400 })
    }

    // ============================================
    // CODE PATH SEPARATION - CLEAR & MAINTAINABLE
    // ============================================
    
    if (searchType === 'keyword') {
      // ===== KEYWORD SEARCH PATH =====
      // New code path - completely separate
      const keyword = targetDomain.trim()
      const keywordMode = body.keywordMode || 'full-url'
      const { whereClause, params } = buildKeywordWhereClause(keyword, keywordMode)
      
      console.log("🔍 Overview API called (keyword):", { keyword, timelineGranularity })
      
      const [timelineData, topSubdomains, topPaths] = await Promise.all([
        getTimelineData(whereClause, params, timelineGranularity || 'auto').catch((err) => {
          console.error("❌ Error getting timeline data:", err)
          return []
        }),
        getTopSubdomains(whereClause, params, 10).catch((err) => {
          console.error("❌ Error getting top subdomains:", err)
          return []
        }),
        getTopPaths(whereClause, params, 10).catch((err) => {
          console.error("❌ Error getting top paths:", err)
          return []
        }),
      ])

      console.log("✅ Overview data retrieved (keyword):", {
        timelineCount: timelineData?.length || 0,
        topSubdomainsCount: topSubdomains?.length || 0,
        topPathsCount: topPaths?.length || 0,
        timelineSample: timelineData?.slice(0, 3),
      })

      return NextResponse.json({
        success: true,
        targetDomain: keyword,
        searchType: 'keyword',
        timeline: timelineData || [],
        topSubdomains: topSubdomains || [],
        topPaths: topPaths || [],
      })
    } else {
      // ===== DOMAIN SEARCH PATH =====
      // EXISTING CODE - NO CHANGES
    let normalizedDomain = targetDomain.trim().toLowerCase()
    normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '')
    normalizedDomain = normalizedDomain.replace(/^www\./, '')
    normalizedDomain = normalizedDomain.replace(/\/$/, '')
    normalizedDomain = normalizedDomain.split('/')[0].split(':')[0]

      const { whereClause, params } = buildDomainWhereClause(normalizedDomain)

      console.log("🔍 Overview API called (domain):", { normalizedDomain, timelineGranularity })
    
    const [timelineData, topSubdomains, topPaths] = await Promise.all([
        getTimelineData(whereClause, params, timelineGranularity || 'auto').catch((err) => {
        console.error("❌ Error getting timeline data:", err)
        return []
      }),
        getTopSubdomains(whereClause, params, 10).catch((err) => {
        console.error("❌ Error getting top subdomains:", err)
        return []
      }),
        getTopPaths(whereClause, params, 10).catch((err) => {
        console.error("❌ Error getting top paths:", err)
        return []
      }),
    ])

      console.log("✅ Overview data retrieved (domain):", {
      timelineCount: timelineData?.length || 0,
      topSubdomainsCount: topSubdomains?.length || 0,
      topPathsCount: topPaths?.length || 0,
      timelineSample: timelineData?.slice(0, 3),
    })

    return NextResponse.json({
      success: true,
      targetDomain: normalizedDomain,
        searchType: 'domain',
      timeline: timelineData || [],
      topSubdomains: topSubdomains || [],
      topPaths: topPaths || [],
    })
    }
  } catch (error) {
    console.error("❌ Error in overview API:", error)
    return NextResponse.json(
      {
        error: "Failed to get overview data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

async function getTimelineData(whereClause: string, params: any[], granularity: string) {
  console.log("📅 Getting timeline data, granularity:", granularity)
  
  // First, check if we have any credentials for this domain
  const credentialCheck = (await executeQuery(
    `SELECT COUNT(*) as count
    FROM credentials c
    ${whereClause}`,
    params
  )) as any[]
  
  const credentialCount = credentialCheck[0]?.count || 0
  console.log("📅 Credentials found for domain:", credentialCount)
  
  if (credentialCount === 0) {
    console.warn("⚠️ No credentials found for domain, returning empty timeline")
    return []
  }
  
  // Helper function to parse log_date with various formats (including time)
  // Handles: DD/MM/YYYY HH:MM:SS, DD.MM.YYYY HH:MM:SS, YYYY-MM-DD HH:MM:SS, etc.
  // Also handles: June 28, 2025, 28 Jun 2025, 29 Jun 25 21:02 CEST, etc.
  const getDateFromLogDate = () => {
    return `CASE 
      WHEN si.log_date IS NOT NULL AND si.log_date != '' THEN
        COALESCE(
          -- NUMERIC FORMATS (priority tinggi)
          -- Format DD/MM/YYYY dengan waktu (19/07/2025 16:02:13) - ambil bagian tanggal saja
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 1), '%d/%m/%Y'),
          -- Format DD.MM.YYYY dengan waktu (28.06.2025 12:28:40) - ambil bagian tanggal saja
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 1), '%d.%m.%Y'),
          -- Format DD/MM/YYYY tanpa waktu (19/07/2025)
          STR_TO_DATE(si.log_date, '%d/%m/%Y'),
          -- Format DD.MM.YYYY tanpa waktu (28.06.2025)
          STR_TO_DATE(si.log_date, '%d.%m.%Y'),
          -- Format YYYY-MM-DD dengan waktu (2025-07-19 16:02:13) - ambil bagian tanggal saja
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 1), '%Y-%m-%d'),
          -- Format YYYY-MM-DD tanpa waktu (2025-07-19)
          STR_TO_DATE(si.log_date, '%Y-%m-%d'),
          -- Format YYYY/MM/DD dengan waktu (2025/07/19 16:02:13) - ambil bagian tanggal saja
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 1), '%Y/%m/%d'),
          -- Format YYYY/MM/DD tanpa waktu (2025/07/19)
          STR_TO_DATE(si.log_date, '%Y/%m/%d'),
          
          -- TEXT FORMATS dengan nama bulan (NEW)
          -- Format: "June 28, 2025" atau "Jun 28, 2025" (month first)
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 3), '%M %d, %Y'),
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 3), '%b %d, %Y'),
          -- Format: "28 Jun 2025" atau "28 June 2025" (day first)
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 3), '%d %b %Y'),
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 3), '%d %M %Y'),
          -- Format: "28 Jun 25" (2 digit tahun, day first)
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 3), '%d %b %y'),
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 3), '%d %M %y'),
          -- Format dengan waktu: "June 28, 2025 16:02:13" (month first dengan waktu)
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 4), '%M %d, %Y %H:%i:%s'),
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 4), '%b %d, %Y %H:%i:%s'),
          -- Format dengan waktu: "28 Jun 2025 16:02:13" (day first dengan waktu)
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 4), '%d %b %Y %H:%i:%s'),
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 4), '%d %M %Y %H:%i:%s'),
          -- Format dengan waktu: "03 September 2024 00:17:30" (day first, full month name)
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 4), '%d %M %Y %H:%i:%s'),
          -- Format dengan timezone: "29 Jun 25 21:02 CEST" (ambil 4 bagian pertama, ignore timezone)
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 4), '%d %b %y %H:%i'),
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 4), '%d %M %y %H:%i'),
          
          -- Fallback ke created_at (jika semua format tidak cocok)
          DATE(c.created_at)
        )
      ELSE DATE(c.created_at)  -- Fallback jika log_date NULL atau empty
    END`
  }

  // Get date range - handle log_date as VARCHAR and convert to DATE
  const dateExprForRange = getDateFromLogDate()
  const dateRangeResult = (await executeQuery(
    `SELECT 
      MIN(${dateExprForRange}) as min_date,
      MAX(${dateExprForRange}) as max_date,
      DATEDIFF(
        MAX(${dateExprForRange}),
        MIN(${dateExprForRange})
      ) as day_range
    FROM credentials c
    LEFT JOIN devices d ON c.device_id = d.device_id
    LEFT JOIN systeminformation si ON d.device_id = si.device_id
    ${whereClause}`,
    params
  )) as any[]

  console.log("📅 Date range result:", dateRangeResult[0])
  
  const dateRange = dateRangeResult[0]
  if (!dateRange || !dateRange.min_date) {
    console.warn("⚠️ No date range found, returning empty timeline")
    return []
  }

  let actualGranularity = granularity
  if (granularity === 'auto') {
    const dayRange = dateRange.day_range || 0
    console.log("📅 Day range:", dayRange)
    if (dayRange < 30) {
      actualGranularity = 'daily'
    } else if (dayRange <= 90) {
      actualGranularity = 'weekly'
    } else {
      actualGranularity = 'monthly'
    }
    console.log("📅 Auto-selected granularity:", actualGranularity)
  }

  // Helper function to get date expression (handles log_date as VARCHAR with various formats)
  // Handles: DD/MM/YYYY HH:MM:SS, DD.MM.YYYY HH:MM:SS, YYYY-MM-DD HH:MM:SS, etc.
  // Also handles: June 28, 2025, 28 Jun 2025, 29 Jun 25 21:02 CEST, etc.
  // Priority: Numeric formats first, then text formats with month names, then fallback to created_at
  const getDateExpr = () => {
    return `CASE 
      WHEN si.log_date IS NOT NULL AND si.log_date != '' THEN
        COALESCE(
          -- NUMERIC FORMATS (priority tinggi)
          -- Format DD/MM/YYYY dengan waktu (19/07/2025 16:02:13) - ambil bagian tanggal saja
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 1), '%d/%m/%Y'),
          -- Format DD.MM.YYYY dengan waktu (28.06.2025 12:28:40) - ambil bagian tanggal saja
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 1), '%d.%m.%Y'),
          -- Format DD/MM/YYYY tanpa waktu (19/07/2025)
          STR_TO_DATE(si.log_date, '%d/%m/%Y'),
          -- Format DD.MM.YYYY tanpa waktu (28.06.2025)
          STR_TO_DATE(si.log_date, '%d.%m.%Y'),
          -- Format YYYY-MM-DD dengan waktu (2025-07-19 16:02:13) - ambil bagian tanggal saja
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 1), '%Y-%m-%d'),
          -- Format YYYY-MM-DD tanpa waktu (2025-07-19)
          STR_TO_DATE(si.log_date, '%Y-%m-%d'),
          -- Format YYYY/MM/DD dengan waktu (2025/07/19 16:02:13) - ambil bagian tanggal saja
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 1), '%Y/%m/%d'),
          -- Format YYYY/MM/DD tanpa waktu (2025/07/19)
          STR_TO_DATE(si.log_date, '%Y/%m/%d'),
          
          -- TEXT FORMATS dengan nama bulan (NEW)
          -- Format: "June 28, 2025" atau "Jun 28, 2025" (month first)
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 3), '%M %d, %Y'),
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 3), '%b %d, %Y'),
          -- Format: "28 Jun 2025" atau "28 June 2025" (day first)
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 3), '%d %b %Y'),
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 3), '%d %M %Y'),
          -- Format: "28 Jun 25" (2 digit tahun, day first)
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 3), '%d %b %y'),
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 3), '%d %M %y'),
          -- Format dengan waktu: "June 28, 2025 16:02:13" (month first dengan waktu)
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 4), '%M %d, %Y %H:%i:%s'),
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 4), '%b %d, %Y %H:%i:%s'),
          -- Format dengan waktu: "28 Jun 2025 16:02:13" (day first dengan waktu)
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 4), '%d %b %Y %H:%i:%s'),
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 4), '%d %M %Y %H:%i:%s'),
          -- Format dengan waktu: "03 September 2024 00:17:30" (day first, full month name)
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 4), '%d %M %Y %H:%i:%s'),
          -- Format dengan timezone: "29 Jun 25 21:02 CEST" (ambil 4 bagian pertama, ignore timezone)
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 4), '%d %b %y %H:%i'),
          STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 4), '%d %M %y %H:%i'),
          
          -- Fallback ke created_at (jika semua format tidak cocok)
          DATE(c.created_at)
        )
      ELSE DATE(c.created_at)  -- Fallback jika log_date NULL atau empty
    END`
  }

  let query = ''
  const dateExpr = getDateExpr()
  
  if (actualGranularity === 'daily') {
    query = `SELECT 
      ${dateExpr} as date,
      COUNT(*) as credential_count
    FROM credentials c
    LEFT JOIN devices d ON c.device_id = d.device_id
    LEFT JOIN systeminformation si ON d.device_id = si.device_id
    ${whereClause}
    GROUP BY date
    ORDER BY date ASC`
  } else if (actualGranularity === 'weekly') {
    query = `SELECT 
      DATE_FORMAT(${dateExpr}, '%Y-%u') as week,
      MIN(${dateExpr}) as date,
      COUNT(*) as credential_count
    FROM credentials c
    LEFT JOIN devices d ON c.device_id = d.device_id
    LEFT JOIN systeminformation si ON d.device_id = si.device_id
    ${whereClause}
    GROUP BY week
    ORDER BY date ASC`
  } else {
    // PERBAIKAN: Menggunakan MIN() untuk memenuhi only_full_group_by
    query = `SELECT 
      DATE_FORMAT(${dateExpr}, '%Y-%m') as month,
      MIN(DATE_FORMAT(${dateExpr}, '%Y-%m-01')) as date,
      COUNT(*) as credential_count
    FROM credentials c
    LEFT JOIN devices d ON c.device_id = d.device_id
    LEFT JOIN systeminformation si ON d.device_id = si.device_id
    ${whereClause}
    GROUP BY month
    ORDER BY date ASC`
  }

  console.log("📅 Executing timeline query with granularity:", actualGranularity)
  console.log("📅 Query:", query.substring(0, 200) + "...")
  
  const result = (await executeQuery(query, params)) as any[]

  console.log("📊 Timeline query result:", result.length, "entries")
  console.log("📊 Sample timeline data (raw):", result.slice(0, 5))

  const mapped = result.map((row: any) => {
    let dateStr = ''
    if (row.date) {
      // Handle different date formats
      const date = new Date(row.date)
      if (!isNaN(date.getTime())) {
        dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
      } else {
        dateStr = String(row.date).split('T')[0]
      }
    }
    return {
      date: dateStr,
      credentialCount: Number(row.credential_count) || 0,
    }
  }).filter(item => item.date) // Remove items with invalid dates

  console.log("📊 Mapped timeline data:", mapped.slice(0, 5))
  console.log("📊 Final timeline data count:", mapped.length)
  return mapped
}

async function getTopSubdomains(whereClause: string, params: any[], limit: number = 10) {
  const result = (await executeQuery(
    `SELECT 
      CASE 
        WHEN c.url LIKE 'http://%' OR c.url LIKE 'https://%' THEN
          SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(REPLACE(c.url, 'http://', ''), 'https://', ''), '/', 1), ':', 1)
        ELSE
          SUBSTRING_INDEX(SUBSTRING_INDEX(c.url, '/', 1), ':', 1)
      END as full_hostname,
      COUNT(*) as credential_count
    FROM credentials c
    ${whereClause}
    GROUP BY 
      CASE 
        WHEN c.url LIKE 'http://%' OR c.url LIKE 'https://%' THEN
          SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(REPLACE(c.url, 'http://', ''), 'https://', ''), '/', 1), ':', 1)
        ELSE
          SUBSTRING_INDEX(SUBSTRING_INDEX(c.url, '/', 1), ':', 1)
      END
    ORDER BY credential_count DESC
    LIMIT ${Number(limit)}`,
    params
  )) as any[]

  return result.map((row: any) => ({
    fullHostname: row.full_hostname || '',
    credentialCount: row.credential_count || 0,
  }))
}

async function getTopPaths(whereClause: string, params: any[], limit: number = 10) {
  const result = (await executeQuery(
    `SELECT 
      CASE 
        WHEN c.url LIKE '%/%' THEN
          COALESCE(
            SUBSTRING_INDEX(
              SUBSTRING_INDEX(
                CASE 
                  WHEN c.url LIKE 'http://%' OR c.url LIKE 'https://%' THEN
                    CASE 
                      WHEN LOCATE('/', c.url, LOCATE('://', c.url) + 3) > 0 THEN
                        SUBSTRING(c.url, LOCATE('/', c.url, LOCATE('://', c.url) + 3))
                      ELSE
                        '/'
                    END
                  ELSE
                    CASE 
                      WHEN LOCATE('/', c.url) > 0 THEN
                        SUBSTRING(c.url, LOCATE('/', c.url))
                      ELSE
                        '/'
                    END
                END,
                '?', 1
              ),
              '#', 1
            ),
            '/'
          )
        ELSE
          '/'
      END as path,
      COUNT(*) as credential_count
    FROM credentials c
    ${whereClause}
    GROUP BY 
      CASE 
        WHEN c.url LIKE '%/%' THEN
          COALESCE(
            SUBSTRING_INDEX(
              SUBSTRING_INDEX(
                CASE 
                  WHEN c.url LIKE 'http://%' OR c.url LIKE 'https://%' THEN
                    CASE 
                      WHEN LOCATE('/', c.url, LOCATE('://', c.url) + 3) > 0 THEN
                        SUBSTRING(c.url, LOCATE('/', c.url, LOCATE('://', c.url) + 3))
                      ELSE
                        '/'
                    END
                  ELSE
                    CASE 
                      WHEN LOCATE('/', c.url) > 0 THEN
                        SUBSTRING(c.url, LOCATE('/', c.url))
                      ELSE
                        '/'
                    END
                END,
                '?', 1
              ),
              '#', 1
            ),
            '/'
          )
        ELSE
          '/'
      END
    ORDER BY credential_count DESC
    LIMIT ${Number(limit)}`,
    params
  )) as any[]

  return result.map((row: any) => ({
    path: row.path || '/',
    credentialCount: row.credential_count || 0,
  }))
}

