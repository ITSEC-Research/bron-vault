import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"

/**
 * Build WHERE clause for domain matching that supports subdomains
 */
function buildDomainWhereClause(targetDomain: string): { whereClause: string; params: any[] } {
  const hostnameExpr = `CASE 
    WHEN c.url LIKE 'http://%' OR c.url LIKE 'https://%' THEN
      LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(REPLACE(c.url, 'http://', ''), 'https://', ''), '/', 1), ':', 1))
    ELSE
      LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(c.url, '/', 1), ':', 1))
  END`
  
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
 */
function buildKeywordWhereClause(keyword: string, mode: 'domain-only' | 'full-url' = 'full-url'): { whereClause: string; params: any[] } {
  if (mode === 'domain-only') {
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

    console.log("🔑 Getting top passwords (separate endpoint)...")
    
    // Use EXISTS for better performance
    const result = (await executeQuery(
      `SELECT 
        ps.password,
        COUNT(DISTINCT ps.device_id) as total_count
      FROM password_stats ps
      WHERE EXISTS (
        SELECT 1
        FROM credentials c
        ${whereClause}
        AND c.device_id = ps.device_id
      )
      AND ps.password IS NOT NULL 
      AND ps.password != '' 
      AND ps.password != ' '
      AND TRIM(ps.password) != ''
      AND LENGTH(TRIM(ps.password)) > 0
      AND ps.password NOT LIKE '%null%'
      AND ps.password NOT LIKE '%undefined%'
      AND ps.password NOT LIKE '%N/A%'
      AND ps.password NOT LIKE '%n/a%'
      AND ps.password NOT LIKE '%none%'
      AND ps.password NOT LIKE '%None%'
      AND ps.password NOT LIKE '%NONE%'
      AND ps.password NOT LIKE '%blank%'
      AND ps.password NOT LIKE '%Blank%'
      AND ps.password NOT LIKE '%BLANK%'
      AND ps.password NOT LIKE '%empty%'
      AND ps.password NOT LIKE '%Empty%'
      AND ps.password NOT LIKE '%EMPTY%'
      AND ps.password != '[NOT_SAVED]'
      AND ps.password NOT LIKE '%[NOT_SAVED]%'
      AND ps.password NOT REGEXP '^[[:space:]]*$'
      GROUP BY ps.password
      ORDER BY total_count DESC, ps.password ASC
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

