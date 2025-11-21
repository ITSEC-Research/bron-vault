import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { targetDomain } = body

    if (!targetDomain || typeof targetDomain !== 'string') {
      return NextResponse.json({ error: "targetDomain is required" }, { status: 400 })
    }

    let normalizedDomain = targetDomain.trim().toLowerCase()
    normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '')
    normalizedDomain = normalizedDomain.replace(/^www\./, '')
    normalizedDomain = normalizedDomain.replace(/\/$/, '')
    normalizedDomain = normalizedDomain.split('/')[0].split(':')[0]

    const summary = await getSummaryStats(normalizedDomain)

    return NextResponse.json({
      success: true,
      targetDomain: normalizedDomain,
      summary,
    })
  } catch (error) {
    console.error("❌ Error in summary API:", error)
    return NextResponse.json(
      {
        error: "Failed to get summary statistics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

/**
 * Build WHERE clause for domain matching that supports subdomains
 * Matches both domain column and hostname extracted from URL
 */
function buildDomainWhereClause(targetDomain: string): { whereClause: string; params: any[] } {
  // Extract hostname from URL expression (reusable)
  const hostnameExpr = `CASE 
    WHEN url LIKE 'http://%' OR url LIKE 'https://%' THEN
      LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(REPLACE(url, 'http://', ''), 'https://', ''), '/', 1), ':', 1))
    ELSE
      LOWER(SUBSTRING_INDEX(SUBSTRING_INDEX(url, '/', 1), ':', 1))
  END`
  
  // Match:
  // 1. Exact domain match: domain = 'api.example.com'
  // 2. Subdomain match: domain LIKE '%.api.example.com' (matches subdomain.api.example.com in domain column)
  // 3. Exact hostname match: hostname_from_url = 'api.example.com' (matches when domain column is base domain like 'example.com')
  // 4. Subdomain hostname match: hostname_from_url LIKE '%.api.example.com' (matches v1.api.example.com, etc.)
  const whereClause = `WHERE (
    domain = ? OR 
    domain LIKE CONCAT('%.', ?) OR
    ${hostnameExpr} = ? OR
    ${hostnameExpr} LIKE CONCAT('%.', ?)
  )`
  
  return {
    whereClause,
    params: [targetDomain, targetDomain, targetDomain, targetDomain]
  }
}

async function getSummaryStats(targetDomain: string) {
  const { whereClause, params } = buildDomainWhereClause(targetDomain)
  
  const subdomainsResult = (await executeQuery(
    `SELECT COUNT(DISTINCT 
      CASE 
        WHEN url LIKE 'http://%' OR url LIKE 'https://%' THEN
          SUBSTRING_INDEX(SUBSTRING_INDEX(REPLACE(REPLACE(url, 'http://', ''), 'https://', ''), '/', 1), ':', 1)
        ELSE
          SUBSTRING_INDEX(SUBSTRING_INDEX(url, '/', 1), ':', 1)
      END
    ) as total
    FROM credentials
    ${whereClause}`,
    params
  )) as any[]

  const totalSubdomains = subdomainsResult[0]?.total || 0

  const pathsResult = (await executeQuery(
    `SELECT COUNT(DISTINCT 
      CASE 
        WHEN url LIKE '%/%' THEN
          COALESCE(
            SUBSTRING_INDEX(
              SUBSTRING_INDEX(
                CASE 
                  WHEN url LIKE 'http://%' OR url LIKE 'https://%' THEN
                    CASE 
                      WHEN LOCATE('/', url, LOCATE('://', url) + 3) > 0 THEN
                        SUBSTRING(url, LOCATE('/', url, LOCATE('://', url) + 3))
                      ELSE
                        '/'
                    END
                  ELSE
                    CASE 
                      WHEN LOCATE('/', url) > 0 THEN
                        SUBSTRING(url, LOCATE('/', url))
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
    ) as total
    FROM credentials
    ${whereClause}`,
    params
  )) as any[]

  const totalPaths = pathsResult[0]?.total || 0

  const credentialsResult = (await executeQuery(
    `SELECT COUNT(*) as total
    FROM credentials
    ${whereClause}`,
    params
  )) as any[]

  const totalCredentials = credentialsResult[0]?.total || 0

  const reusedResult = (await executeQuery(
    `SELECT COUNT(*) as total
    FROM (
      SELECT username, password, url, COUNT(*) as count
      FROM credentials
      ${whereClause}
      GROUP BY username, password, url
      HAVING count > 1
    ) as reused`,
    params
  )) as any[]

  const totalReusedCredentials = reusedResult[0]?.total || 0

  const devicesResult = (await executeQuery(
    `SELECT COUNT(DISTINCT device_id) as total
    FROM credentials
    ${whereClause}`,
    params
  )) as any[]

  const totalDevices = devicesResult[0]?.total || 0

  return {
    totalSubdomains,
    totalPaths,
    totalCredentials,
    totalReusedCredentials,
    totalDevices,
  }
}

