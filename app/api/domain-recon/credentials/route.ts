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
  ) AND c.domain IS NOT NULL`
  
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
    const { targetDomain, filters, pagination, searchQuery } = body

    if (!targetDomain || typeof targetDomain !== 'string') {
      return NextResponse.json({ error: "targetDomain is required" }, { status: 400 })
    }

    let normalizedDomain = targetDomain.trim().toLowerCase()
    normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '')
    normalizedDomain = normalizedDomain.replace(/^www\./, '')
    normalizedDomain = normalizedDomain.replace(/\/$/, '')
    normalizedDomain = normalizedDomain.split('/')[0].split(':')[0]

    console.log("🔍 Credentials API called:", { normalizedDomain, filters, pagination, searchQuery })
    const credentialsData = await getCredentialsData(normalizedDomain, filters, pagination, searchQuery)
    console.log("✅ Credentials data retrieved:", {
      dataCount: credentialsData.data?.length || 0,
      pagination: credentialsData.pagination,
      sample: credentialsData.data?.slice(0, 2),
    })

    return NextResponse.json({
      success: true,
      targetDomain: normalizedDomain,
      credentials: credentialsData.data || [],
      pagination: credentialsData.pagination,
    })
  } catch (error) {
    console.error("❌ Error in credentials API:", error)
    return NextResponse.json(
      {
        error: "Failed to get credentials data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

async function getCredentialsData(
  targetDomain: string,
  filters?: any,
  pagination?: any,
  searchQuery?: string
) {
  const page = Number(pagination?.page) || 1
  const limit = Number(pagination?.limit) || 50
  const offset = Number((page - 1) * limit)
  
  const allowedSortColumns = ['created_at', 'url', 'username', 'log_date', 'device_id']
  const sortBy = allowedSortColumns.includes(pagination?.sortBy) 
    ? pagination.sortBy 
    : 'created_at'
  const sortOrder = (pagination?.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

  // Build WHERE clause for domain matching with subdomain support
  const { whereClause, params: domainParams } = buildDomainWhereClause(targetDomain)
  const params: any[] = [...domainParams]
  
  console.log("🔍 Building WHERE clause for domain:", targetDomain)

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

  if (filters?.browser) {
    finalWhereClause += ` AND c.browser = ?`
    params.push(filters.browser)
  }

  if (filters?.deviceId) {
    finalWhereClause += ` AND c.device_id = ?`
    params.push(filters.deviceId)
  }

  // Add search query filter (searches in url, username, and device_name)
  if (searchQuery && searchQuery.trim()) {
    const searchTerm = `%${searchQuery.trim()}%`
    finalWhereClause += ` AND (
      LOWER(c.url) LIKE ? OR 
      LOWER(c.username) LIKE ? OR 
      LOWER(COALESCE(d.device_name, '')) LIKE ?
    )`
    params.push(searchTerm.toLowerCase(), searchTerm.toLowerCase(), searchTerm.toLowerCase())
  }

  console.log("📊 Executing count query:", { whereClause: finalWhereClause, params })
  const countResult = (await executeQuery(
    `SELECT COUNT(*) as total
    FROM credentials c
    LEFT JOIN devices d ON c.device_id = d.device_id
    ${finalWhereClause}`,
    params
  )) as any[]

  const total = countResult[0]?.total || 0
  console.log("📊 Total credentials found:", total)

  // Validate sortBy to prevent SQL injection
  const validSortColumns = ['created_at', 'url', 'username', 'log_date', 'device_id']
  const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at'
  const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC'

  // Build ORDER BY clause - handle log_date specially since it's from systeminformation table
  let orderByClause = ''
  if (safeSortBy === 'log_date') {
    // For log_date, we need to use COALESCE to handle NULL and parse the date
    orderByClause = `ORDER BY COALESCE(
      STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 1), '%d/%m/%Y'),
      STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 1), '%d.%m.%Y'),
      STR_TO_DATE(si.log_date, '%d/%m/%Y'),
      STR_TO_DATE(si.log_date, '%d.%m.%Y'),
      STR_TO_DATE(SUBSTRING_INDEX(si.log_date, ' ', 1), '%Y-%m-%d'),
      STR_TO_DATE(si.log_date, '%Y-%m-%d'),
      c.created_at
    ) ${safeSortOrder}`
  } else if (safeSortBy === 'url' || safeSortBy === 'username') {
    orderByClause = `ORDER BY c.${safeSortBy} ${safeSortOrder}`
  } else if (safeSortBy === 'device_id') {
    orderByClause = `ORDER BY c.device_id ${safeSortOrder}`
  } else {
    // created_at (default)
    orderByClause = `ORDER BY c.created_at ${safeSortOrder}`
  }

  const dataQuery = `SELECT 
      c.id,
      c.url,
      c.username,
      c.password,
      c.browser,
      c.device_id as deviceId,
      d.device_name as deviceName,
      c.created_at as createdAt,
      si.log_date as logDate
    FROM credentials c
    LEFT JOIN devices d ON c.device_id = d.device_id
    LEFT JOIN systeminformation si ON d.device_id = si.device_id
    ${finalWhereClause}
    ${orderByClause}
    LIMIT ${Number(limit)} OFFSET ${Number(offset)}`

  console.log("📊 Executing data query:", { 
    query: dataQuery.substring(0, 200) + "...",
    params: params.length,
    limit,
    offset 
  })

  const data = (await executeQuery(
    dataQuery,
    [...params]
  )) as any[]

  console.log("📊 Data retrieved:", { count: data.length, sample: data.slice(0, 1) })

  return {
    data: data.map((row: any) => ({
      id: row.id,
      url: row.url || '',
      username: row.username || '',
      password: row.password || '',
      browser: row.browser || 'Unknown',
      deviceId: row.deviceId || '',
      deviceName: row.deviceName || '',
      createdAt: row.createdAt || '',
      logDate: row.logDate || null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

