import { NextRequest, NextResponse } from "next/server"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"
import { validateRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { targetDomain, filters, pagination, searchQuery, searchType = 'domain' } = body

    if (!targetDomain || typeof targetDomain !== 'string') {
      return NextResponse.json({ error: "targetDomain is required" }, { status: 400 })
    }

    // Normalize Domain
    let cleanDomain = targetDomain.trim().toLowerCase()
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0]

    // Cleaner log: only show search if present
    const logData: any = { type: searchType, domain: cleanDomain }
    if (searchQuery && searchQuery.trim()) {
      logData.search = searchQuery.trim()
    }
    console.log("🚀 API Called (Optimized):", logData)

    // Call the new data getter function
    const credentialsData = await getCredentialsDataOptimized(cleanDomain, filters, pagination, searchQuery, searchType, body.keywordMode)

    return NextResponse.json({
      success: true,
      targetDomain: cleanDomain,
      searchType,
      credentials: credentialsData.data || [],
      pagination: credentialsData.pagination,
    })

  } catch (error) {
    console.error("❌ Error in credentials API:", error)
    return NextResponse.json(
      { error: "Failed to get credentials data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

async function getCredentialsDataOptimized(
  query: string,
  filters?: any,
  pagination?: any,
  searchQuery?: string,
  searchType: 'domain' | 'keyword' = 'domain',
  keywordMode: 'domain-only' | 'full-url' = 'full-url'
) {
  const page = Number(pagination?.page) || 1
  const limit = Number(pagination?.limit) || 50
  const offset = Number((page - 1) * limit)
  
  // Setup Sort
  const allowedSortColumns = ['created_at', 'url', 'username', 'log_date', 'device_id']
  let sortBy = allowedSortColumns.includes(pagination?.sortBy) ? pagination.sortBy : 'created_at'
  const sortOrder = (pagination?.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

  // ==========================================
  // 1. BUILD PREWHERE (Main Table Filters)
  // ==========================================
  // PREWHERE is the key to speed in ClickHouse. 
  // It filters before JOIN and before reading heavy columns.
  
  let prewhereConditions: string[] = []
  const params: Record<string, any> = {}

  if (searchType === 'domain') {
    // DOMAIN OPTIMIZATION:
    // 1. Check Exact Match domain
    // 2. Check Subdomain using endsWith (much faster than ilike/regex)
    // 3. Fallback to URL pattern match only if needed
    
    params['targetDomain'] = query
    params['dotTargetDomain'] = '.' + query
    
    // Logic: Domain column exact match OR Domain column ends with .target.com
    // This leverages suffix index if available, or at least fast string scan
    prewhereConditions.push(`(
      c.domain = {targetDomain:String} OR 
      endsWith(c.domain, {dotTargetDomain:String}) OR
      c.url ilike {urlPattern:String} 
    )`)
    // Fallback URL pattern for catch-all
    params['urlPattern'] = `%${query}%`

  } else {
    // KEYWORD SEARCH
    params['keyword'] = query
    params['likeKeyword'] = `%${query}%`
    
    if (keywordMode === 'domain-only') {
      prewhereConditions.push(`(c.domain ilike {likeKeyword:String})`)
    } else {
      // Optimization: multiSearchAnyCase is faster than OR OR OR
      // But for simplicity and param binding, we use ilike in PREWHERE 
      // because PREWHERE already significantly reduces cost.
      prewhereConditions.push(`(c.url ilike {likeKeyword:String} OR c.domain ilike {likeKeyword:String})`)
    }
  }

  // Additional Filters to PREWHERE (To filter faster at the start)
  if (filters?.subdomain) {
    prewhereConditions.push(`c.url ilike {subdomainFilter:String}`)
    params['subdomainFilter'] = `%${filters.subdomain}%`
  }
  if (filters?.path) {
    prewhereConditions.push(`c.url ilike {pathFilter:String}`)
    params['pathFilter'] = `%${filters.path}%`
  }
  if (filters?.browser) {
    prewhereConditions.push(`c.browser = {browserFilter:String}`)
    params['browserFilter'] = filters.browser
  }
  if (filters?.deviceId) {
    prewhereConditions.push(`c.device_id = {deviceIdFilter:String}`)
    params['deviceIdFilter'] = filters.deviceId
  }

  // Construct PREWHERE Clause
  const prewhereClause = prewhereConditions.length > 0 
    ? `PREWHERE ${prewhereConditions.join(' AND ')}` 
    : ''

  // ==========================================
  // 2. BUILD WHERE (Join Table Filters)
  // ==========================================
  // Filters that require JOIN go in WHERE (executed after PREWHERE)

  let whereConditions: string[] = []
  const hasGlobalSearch = searchQuery && searchQuery.trim().length > 0

  if (hasGlobalSearch) {
    const searchTerm = searchQuery.trim()
    const searchParamKey = `globalSearch`
    
    // We use conditional logic technique
    // Search in table C (url/username) OR table D (device_name)
    whereConditions.push(`(
      positionCaseInsensitive(c.url, {${searchParamKey}:String}) > 0 OR
      positionCaseInsensitive(c.username, {${searchParamKey}:String}) > 0 OR
      positionCaseInsensitive(d.device_name, {${searchParamKey}:String}) > 0
    )`)
    
    params[searchParamKey] = searchTerm
  }

  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(' AND ')}` 
    : ''

  // ==========================================
  // 3. EXECUTE COUNT (Optimized)
  // ==========================================
  
  let countQuery = ''
  
  if (hasGlobalSearch) {
    // Slow Path: Must JOIN because searching device_name
    console.log("📊 Count: Slow Path (Global Search Active)")
    countQuery = `
      SELECT count() as total
      FROM credentials c
      LEFT JOIN devices d ON c.device_id = d.device_id
      ${prewhereClause}
      ${whereClause}
    `
  } else {
    // Fast Path: Main table only
    // PREWHERE is very effective here
    console.log("📊 Count: Fast Path (Main Table Only)")
    countQuery = `
      SELECT count() as total
      FROM credentials c
      ${prewhereClause}
    `
  }

  const countResult = (await executeClickHouseQuery(countQuery, params)) as any[]
  const total = countResult[0]?.total || 0

  // ==========================================
  // 4. EXECUTE DATA
  // ==========================================

  // Handle Sort Log Date (Requires Join Logic)
  let orderByClause = ''
  if (sortBy === 'log_date') {
    orderByClause = `ORDER BY coalesce(toDate(si.log_date), c.created_at) ${sortOrder}`
  } else if (sortBy === 'device_id') {
    orderByClause = `ORDER BY c.device_id ${sortOrder}`
  } else {
    orderByClause = `ORDER BY c.${sortBy} ${sortOrder}`
  }

  const dataQuery = `
    SELECT 
      c.id as id,
      c.url,
      c.username as username,
      c.password as password,
      c.browser as browser,
      c.device_id as deviceId,
      d.device_name as deviceName,
      c.created_at as createdAt,
      si.log_date as logDate
    FROM credentials c
    LEFT JOIN devices d ON c.device_id = d.device_id
    LEFT JOIN systeminformation si ON d.device_id = si.device_id
    ${prewhereClause} -- Heavy filters executed first here
    ${whereClause}    -- Light/join filters executed later
    ${orderByClause}
    LIMIT ${Number(limit)} OFFSET ${Number(offset)}
  `

  console.log("📊 Data Query Executing with PREWHERE...")

  const data = (await executeClickHouseQuery(dataQuery, params)) as any[]

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

