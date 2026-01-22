/**
 * Build WHERE clause for date filtering in ClickHouse queries
 * Supports filtering by upload_date (devices) or log_date (systeminformation)
 */

export interface DateFilterParams {
  startDate?: string // YYYY-MM-DD format
  endDate?: string // YYYY-MM-DD format
}

/**
 * Build date filter WHERE clause for devices table (upload_date)
 * Note: ClickHouse stores upload_date as DateTime, so we need to use toDate() for proper comparison
 */
export function buildDeviceDateFilter(params: DateFilterParams): {
  whereClause: string
  hasFilter: boolean
} {
  if (!params.startDate && !params.endDate) {
    return { whereClause: "", hasFilter: false }
  }

  const conditions: string[] = []

  if (params.startDate) {
    // Use toDate() to convert DateTime to Date for comparison in ClickHouse
    conditions.push(`toDate(upload_date) >= '${params.startDate}'`)
  }

  if (params.endDate) {
    // Include the entire end date by using <= instead of <
    conditions.push(`toDate(upload_date) <= '${params.endDate}'`)
  }

  if (conditions.length === 0) {
    return { whereClause: "", hasFilter: false }
  }

  return {
    whereClause: `WHERE ${conditions.join(" AND ")}`,
    hasFilter: true,
  }
}

/**
 * Build date filter WHERE clause for systeminformation table (log_date)
 * Note: log_date is stored as VARCHAR in YYYY-MM-DD format
 */
export function buildSystemInfoDateFilter(params: DateFilterParams): {
  whereClause: string
  hasFilter: boolean
} {
  if (!params.startDate && !params.endDate) {
    return { whereClause: "", hasFilter: false }
  }

  const conditions: string[] = []

  if (params.startDate) {
    conditions.push(`log_date >= '${params.startDate}'`)
  }

  if (params.endDate) {
    conditions.push(`log_date <= '${params.endDate}'`)
  }

  if (conditions.length === 0) {
    return { whereClause: "", hasFilter: false }
  }

  return {
    whereClause: `WHERE ${conditions.join(" AND ")}`,
    hasFilter: true,
  }
}

/**
 * Build date filter for JOIN queries (devices + systeminformation)
 * Uses log_date from systeminformation if available, otherwise upload_date from devices
 */
export function buildCombinedDateFilter(params: DateFilterParams): {
  whereClause: string
  hasFilter: boolean
} {
  if (!params.startDate && !params.endDate) {
    return { whereClause: "", hasFilter: false }
  }

  const conditions: string[] = []

  if (params.startDate) {
    // Use log_date if available, otherwise fallback to upload_date
    conditions.push(
      `(coalesce(toDate(si.log_date), d.upload_date) >= '${params.startDate}')`
    )
  }

  if (params.endDate) {
    // Add 1 day to endDate to include the entire end date
    const endDate = new Date(params.endDate)
    endDate.setDate(endDate.getDate() + 1)
    const endDateStr = endDate.toISOString().split("T")[0]
    conditions.push(
      `(coalesce(toDate(si.log_date), d.upload_date) < '${endDateStr}')`
    )
  }

  if (conditions.length === 0) {
    return { whereClause: "", hasFilter: false }
  }

  return {
    whereClause: `WHERE ${conditions.join(" AND ")}`,
    hasFilter: true,
  }
}

/**
 * Parse date filter params from NextRequest
 */
export function parseDateFilterFromRequest(
  searchParams: URLSearchParams
): DateFilterParams {
  const startDate = searchParams.get("startDate") || undefined
  const endDate = searchParams.get("endDate") || undefined

  return {
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  }
}
