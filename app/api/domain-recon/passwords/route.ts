import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"

/**
 * Build WHERE clause for domain matching that supports subdomains
 * OPTIMIZED: Avoid heavy string manipulation in SQL (REPLACE, SUBSTRING, CASE)
 * Use simple LIKE patterns instead - much faster even if slightly less precise
 */
function buildDomainWhereClause(targetDomain: string): { whereClause: string; params: any[] } {
  // Strategy: Check domain column (indexed) OR URL contains domain
  // This avoids expensive string functions that prevent index usage
  const whereClause = `WHERE (
    c.domain = ? OR 
    c.domain LIKE CONCAT('%.', ?) OR
    c.url LIKE ? OR
    c.url LIKE ?
  ) AND c.domain IS NOT NULL`
  
  return {
    whereClause,
    params: [
      targetDomain,                              // Exact domain match
      targetDomain,                              // Subdomain match (%.target.com)
      `%://${targetDomain}/%`,                   // Match: https://target.com/
      `%://${targetDomain}:%`                    // Match: https://target.com:8080/
    ]
  }
}

/**
 * Build WHERE clause for keyword search
 * OPTIMIZED: Use simple LIKE instead of heavy string manipulation
 */
function buildKeywordWhereClause(keyword: string, mode: 'domain-only' | 'full-url' = 'full-url'): { whereClause: string; params: any[] } {
  if (mode === 'domain-only') {
    // For domain-only, check both domain column and URL
    const whereClause = `WHERE (
      c.domain LIKE ? OR
      c.url LIKE ? OR
      c.url LIKE ?
    ) AND c.url IS NOT NULL`
    return {
      whereClause,
      params: [
        `%${keyword}%`,           // Domain column contains keyword
        `%://%${keyword}%/%`,     // URL contains keyword in hostname
        `%://%${keyword}%:%`       // URL contains keyword in hostname with port
      ]
    }
  } else {
    // Full URL mode: search keyword anywhere in URL
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
    const { targetDomain, searchType = 'domain', keywordMode } = body

    if (!targetDomain || typeof targetDomain !== 'string') {
      return NextResponse.json({ error: "targetDomain is required" }, { status: 400 })
    }

    let whereClause: string
    let params: any[]

    if (searchType === 'keyword') {
      const keyword = targetDomain.trim()
      const mode = keywordMode || 'full-url'
      const result = buildKeywordWhereClause(keyword, mode)
      whereClause = result.whereClause
      params = result.params
    } else {
      let normalizedDomain = targetDomain.trim().toLowerCase()
      normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '')
      normalizedDomain = normalizedDomain.replace(/^www\./, '')
      normalizedDomain = normalizedDomain.replace(/\/$/, '')
      normalizedDomain = normalizedDomain.split('/')[0].split(':')[0]

      const result = buildDomainWhereClause(normalizedDomain)
      whereClause = result.whereClause
      params = result.params
    }

    console.log("🔑 Getting top passwords (optimized query)...")
    
    // OPTIMIZED QUERY:
    // 1. Removed nested subquery - directly COUNT(DISTINCT device_id) in main query
    // 2. Optimized password blacklist - use NOT IN for exact matches (faster than multiple NOT LIKE)
    // 3. Simplified domain matching - uses LIKE instead of heavy string functions
    // Result: 1 password per device for the domain, then count how many devices use each password
    const result = (await executeQuery(
      `SELECT 
        c.password,
        COUNT(DISTINCT c.device_id) as total_count
      FROM credentials c
      ${whereClause}
      AND c.password IS NOT NULL
      AND LENGTH(TRIM(c.password)) > 2
      AND c.password NOT IN ('', ' ', 'null', 'undefined', 'N/A', 'n/a', 'none', 'None', 'NONE', 'blank', 'Blank', 'BLANK', 'empty', 'Empty', 'EMPTY', '[NOT_SAVED]')
      AND c.password NOT LIKE '%[NOT_SAVED]%'
      AND c.password NOT REGEXP '^[[:space:]]*$'
      GROUP BY c.password
      ORDER BY total_count DESC, c.password ASC
      LIMIT 10`,
      params
    )) as any[]

    console.log("🔑 Top passwords query result:", result.length, "items")
    
    const topPasswords = result.map((row: any) => ({
      password: row.password || '',
      total_count: Number(row.total_count) || 0,
    }))

    return NextResponse.json({
      success: true,
      topPasswords: topPasswords || [],
    })
  } catch (error) {
    console.error("❌ Error in passwords API:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get top passwords",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

