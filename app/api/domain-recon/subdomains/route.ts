import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"

/**
 * Build WHERE clause for domain matching that supports subdomains
 * Matches both domain column and hostname extracted from URL
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
  )`
  
  return {
    whereClause,
    params: [targetDomain, targetDomain, targetDomain, targetDomain]
  }
}

export async function POST(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { targetDomain, filters, pagination } = body

    if (!targetDomain || typeof targetDomain !== 'string') {
      return NextResponse.json({ error: "targetDomain is required" }, { status: 400 })
    }

    let normalizedDomain = targetDomain.trim().toLowerCase()
    normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '')
    normalizedDomain = normalizedDomain.replace(/^www\./, '')
    normalizedDomain = normalizedDomain.replace(/\/$/, '')
    normalizedDomain = normalizedDomain.split('/')[0].split(':')[0]

    const subdomainsData = await getSubdomainsData(normalizedDomain, filters, pagination)

    return NextResponse.json({
      success: true,
      targetDomain: normalizedDomain,
      subdomains: subdomainsData.data || [],
      pagination: subdomainsData.pagination,
    })
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
  targetDomain: string,
  filters?: any,
  pagination?: any
) {
  const page = Number(pagination?.page) || 1
  const limit = Number(pagination?.limit) || 50
  const offset = Number((page - 1) * limit)
  
  const allowedSortColumns = ['credential_count', 'full_hostname', 'path']
  const sortBy = allowedSortColumns.includes(pagination?.sortBy) 
    ? pagination.sortBy 
    : 'credential_count'
  const sortOrder = (pagination?.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

  const { whereClause, params: domainParams } = buildDomainWhereClause(targetDomain)
  const params: any[] = [...domainParams]

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
      fullHostname: row.full_hostname || targetDomain,
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

