import { NextRequest, NextResponse } from "next/server"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"
import { validateRequest } from "@/lib/auth"
import { throwIfAborted, getRequestSignal, handleAbortError } from "@/lib/api-helpers"
import { parseSearchQuery } from "@/lib/query-parser"
import { buildDomainReconCondition, buildKeywordReconCondition } from "@/lib/search-query-builder"

export async function POST(request: NextRequest) {
  // ✅ Check abort VERY EARLY - before validateRequest
  throwIfAborted(request)
  
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if request was aborted early
    throwIfAborted(request)
    
    const body = await request.json()
    const { targetDomain, filters, pagination, searchQuery, searchType = 'domain' } = body

    if (!targetDomain || typeof targetDomain !== 'string') {
      return NextResponse.json({ error: "targetDomain is required" }, { status: 400 })
    }

    // Normalize Domain
    const cleanDomain = targetDomain.trim().toLowerCase()

    // Parse query for operator support (OR, NOT, wildcard, exact)
    const parsed = parseSearchQuery(cleanDomain)

    // Cleaner log: only show search if present
    const logData: any = { type: searchType, domain: cleanDomain, terms: parsed.terms.length }
    if (searchQuery && searchQuery.trim()) {
      logData.search = searchQuery.trim()
    }
    console.log("🚀 API Called (Optimized):", logData)

    // Get signal for passing to database queries
    const signal = getRequestSignal(request)

    // Check abort before expensive operations
    throwIfAborted(request)

    // Call the new data getter function
    const credentialsData = await getCredentialsDataOptimized(parsed, filters, pagination, searchQuery, searchType, body.keywordMode, signal)
    
    // Check abort after operations
    throwIfAborted(request)

    return NextResponse.json({
      success: true,
      targetDomain: cleanDomain,
      searchType,
      credentials: credentialsData.data || [],
      pagination: credentialsData.pagination,
    })

  } catch (error) {
    // Handle abort errors gracefully
    const abortResponse = handleAbortError(error)
    if (abortResponse) {
      return abortResponse
    }
    
    // Handle other errors
    console.error("❌ Error in credentials API:", error)
    return NextResponse.json(
      { error: "Failed to get credentials data", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

async function getCredentialsDataOptimized(
  parsed: import("@/lib/query-parser").ParsedQuery,
  filters?: any,
  pagination?: any,
  searchQuery?: string,
  searchType: 'domain' | 'keyword' = 'domain',
  keywordMode: 'domain-only' | 'full-url' = 'full-url',
  signal?: AbortSignal
) {
  // SECURITY: Validate and sanitize pagination parameters
  const page = Math.max(1, Math.floor(Number(pagination?.page)) || 1)
  const limit = Math.min(1000, Math.max(1, Math.floor(Number(pagination?.limit)) || 50))
  const offset = Math.max(0, Math.floor((page - 1) * limit))
  
  // SECURITY: Whitelist allowed sort columns to prevent SQL injection
  const allowedSortColumns: Record<string, string> = {
    'created_at': 'c.created_at',
    'url': 'c.url',
    'username': 'c.username',
    'log_date': 'log_date', // Special handling below
    'device_id': 'c.device_id'
  }
  const sortByInput = String(pagination?.sortBy || 'created_at')
  const sortBy = allowedSortColumns[sortByInput] ? sortByInput : 'created_at'
  const sortOrder = (pagination?.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

  // ==========================================
  // 1. BUILD PREWHERE (Main Table Filters)
  // ==========================================
  // Use the shared query builder for the main domain/keyword condition
  
  const prewhereConditions: string[] = []
  const params: Record<string, any> = {}

  if (searchType === 'domain') {
    const built = buildDomainReconCondition(parsed, { notNullCheck: false })
    prewhereConditions.push(`(${built.condition})`)
    Object.assign(params, built.params)
  } else {
    const built = buildKeywordReconCondition(parsed, keywordMode)
    prewhereConditions.push(`(${built.condition})`)
    Object.assign(params, built.params)
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

  const whereConditions: string[] = []
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

  const countResult = (await executeClickHouseQuery(countQuery, params, signal)) as any[]
  const total = countResult[0]?.total || 0

  // ==========================================
  // 4. EXECUTE DATA
  // ==========================================

  // Handle Sort Log Date (Requires Join Logic)
  // SECURITY: Build ORDER BY using whitelisted column mapping
  let orderByClause = ''
  if (sortBy === 'log_date') {
    orderByClause = `ORDER BY coalesce(toDate(si.log_date), c.created_at) ${sortOrder}`
  } else {
    // Use the pre-validated column from allowedSortColumns mapping
    const safeColumn = allowedSortColumns[sortBy] || 'c.created_at'
    orderByClause = `ORDER BY ${safeColumn} ${sortOrder}`
  }

  // SECURITY: Use parameterized LIMIT/OFFSET for ClickHouse
  // Add limit and offset to params object
  params['queryLimit'] = limit
  params['queryOffset'] = offset

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
    LIMIT {queryLimit:UInt32} OFFSET {queryOffset:UInt32}
  `

  console.log("📊 Data Query Executing with PREWHERE...")

  const data = (await executeClickHouseQuery(dataQuery, params, signal)) as any[]

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

