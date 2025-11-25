import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"

/**
 * Build WHERE clause for domain matching that supports subdomains
 * OPTIMIZED: Uses index-friendly patterns to leverage idx_domain index
 * Prioritizes domain column (indexed) over URL parsing (slower)
 */
function buildDomainWhereClause(targetDomain: string): { whereClause: string; params: any[] } {
  // OPTIMIZED STRATEGY:
  // 1. Use domain column first (has index idx_domain) - exact and LIKE matches
  // 2. Use simple URL LIKE patterns (can use prefix index) instead of complex string functions
  // 3. Avoid CASE/SUBSTRING_INDEX/REPLACE in WHERE clause (prevents index usage)
  // 4. Match patterns equivalent to old query but index-friendly
  
  // Match patterns (equivalent to old query):
  // 1. Exact domain match: domain = 'api.example.com' (uses idx_domain index)
  // 2. Subdomain match: domain LIKE '%.api.example.com' (uses idx_domain index)
  // 3. URL exact hostname: url LIKE '%://api.example.com/%' OR '%://api.example.com:%' (exact match)
  // 4. URL subdomain hostname: url LIKE '%://%.api.example.com/%' OR '%://%.api.example.com:%' (subdomain match)
  const whereClause = `WHERE (
    c.domain = ? OR 
    c.domain LIKE CONCAT('%.', ?) OR
    c.url LIKE ? OR
    c.url LIKE ? OR
    c.url LIKE ? OR
    c.url LIKE ?
  )`
  
  return {
    whereClause,
    params: [
      targetDomain,                              // Exact domain match (uses idx_domain)
      targetDomain,                              // Subdomain match (uses idx_domain)
      `%://${targetDomain}/%`,                   // URL exact: https://api.example.com/
      `%://${targetDomain}:%`,                   // URL exact with port: https://api.example.com:8080
      `%://%.${targetDomain}/%`,                  // URL subdomain: https://v1.api.example.com/
      `%://%.${targetDomain}:%`                   // URL subdomain with port: https://v1.api.example.com:8080
    ]
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
    const { targetDomain, filters, pagination, searchType = 'domain' } = body

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
      const subdomainsData = await getSubdomainsData(keyword, filters, pagination, 'keyword', keywordMode)

      return NextResponse.json({
        success: true,
        targetDomain: keyword,
        searchType: 'keyword',
        subdomains: subdomainsData.data || [],
        pagination: subdomainsData.pagination,
      })
    } else {
      // ===== DOMAIN SEARCH PATH =====
      // EXISTING CODE - NO CHANGES
    let normalizedDomain = targetDomain.trim().toLowerCase()
    normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '')
    normalizedDomain = normalizedDomain.replace(/^www\./, '')
    normalizedDomain = normalizedDomain.replace(/\/$/, '')
    normalizedDomain = normalizedDomain.split('/')[0].split(':')[0]

      const subdomainsData = await getSubdomainsData(normalizedDomain, filters, pagination, 'domain')

    return NextResponse.json({
      success: true,
      targetDomain: normalizedDomain,
        searchType: 'domain',
      subdomains: subdomainsData.data || [],
      pagination: subdomainsData.pagination,
    })
    }
  } catch (error) {
    console.error("❌ Error in subdomains API:", error)
    return NextResponse.json(
      {
        error: "Failed to get subdomains data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

async function getSubdomainsData(
  query: string,
  filters?: any,
  pagination?: any,
  searchType: 'domain' | 'keyword' = 'domain',
  keywordMode: 'domain-only' | 'full-url' = 'full-url'
) {
  const page = Number(pagination?.page) || 1
  const limit = Number(pagination?.limit) || 50
  const offset = Number((page - 1) * limit)
  
  const allowedSortColumns = ['credential_count', 'full_hostname', 'path']
  const sortBy = allowedSortColumns.includes(pagination?.sortBy) 
    ? pagination.sortBy 
    : 'credential_count'
  const sortOrder = (pagination?.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

  // Build WHERE clause based on search type
  const { whereClause, params: baseParams } = searchType === 'keyword' 
    ? buildKeywordWhereClause(query, keywordMode)
    : buildDomainWhereClause(query)
  const params: any[] = [...baseParams]

  let finalWhereClause = whereClause
  if (filters?.subdomain) {
    finalWhereClause += ` AND (
      CASE 
        WHEN c.url LIKE 'http://%' OR c.url LIKE 'https://%' THEN
          SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(REPLACE(c.url, 'http://', ''), 'https://', ''), '/', 1), ':', 1)
        ELSE
          SUBSTRING_INDEX(SUBSTRING_INDEX(c.url, '/', 1), ':', 1)
      END
    ) LIKE ?`
    params.push(`%${filters.subdomain}%`)
  }

  if (filters?.path) {
    finalWhereClause += ` AND c.url LIKE ?`
    params.push(`%${filters.path}%`)
  }

  const countResult = (await executeQuery(
    `SELECT COUNT(DISTINCT CONCAT(
      CASE 
        WHEN c.url LIKE 'http://%' OR c.url LIKE 'https://%' THEN
          SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(REPLACE(c.url, 'http://', ''), 'https://', ''), '/', 1), ':', 1)
        ELSE
          SUBSTRING_INDEX(SUBSTRING_INDEX(c.url, '/', 1), ':', 1)
      END,
      '|',
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
    )) as total
    FROM credentials c
    ${finalWhereClause}`,
    params
  )) as any[]

  const total = countResult[0]?.total || 0

  const data = (await executeQuery(
    `SELECT 
      CASE 
        WHEN c.url LIKE 'http://%' OR c.url LIKE 'https://%' THEN
          SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(REPLACE(c.url, 'http://', ''), 'https://', ''), '/', 1), ':', 1)
        ELSE
          SUBSTRING_INDEX(SUBSTRING_INDEX(c.url, '/', 1), ':', 1)
      END as full_hostname,
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
    ${finalWhereClause}
    GROUP BY 
      CASE 
        WHEN c.url LIKE 'http://%' OR c.url LIKE 'https://%' THEN
          SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(REPLACE(c.url, 'http://', ''), 'https://', ''), '/', 1), ':', 1)
        ELSE
          SUBSTRING_INDEX(SUBSTRING_INDEX(c.url, '/', 1), ':', 1)
      END,
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
    ORDER BY ${sortBy === 'full_hostname' ? 'full_hostname' : sortBy === 'path' ? 'path' : 'credential_count'} ${sortOrder}
    LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    [...params]
  )) as any[]

  return {
    data: data.map((row: any) => ({
      fullHostname: row.full_hostname || '',
      path: row.path || '/',
      credentialCount: row.credential_count || 0,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

