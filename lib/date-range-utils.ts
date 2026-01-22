import { format, subDays, subMonths, startOfDay, endOfDay, startOfToday, endOfToday } from "date-fns"

export type DateRangePreset = 
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "last_6_months"
  | "last_year"
  | "all_time"

export type DateRangeType =
  | { type: "all_time" }
  | { type: "preset"; preset: DateRangePreset }
  | { type: "custom"; start: Date; end: Date }

export interface DateRange {
  type: DateRangeType
  start: Date | null
  end: Date | null
  label: string
}

/**
 * Calculate date range based on preset
 */
export function getPresetDateRange(preset: DateRangePreset): { start: Date; end: Date } | null {
  const today = new Date()
  
  switch (preset) {
    case "today":
      return {
        start: startOfToday(),
        end: endOfToday(),
      }
    case "last_7_days":
      return {
        start: startOfDay(subDays(today, 6)),
        end: endOfToday(),
      }
    case "last_30_days":
      return {
        start: startOfDay(subDays(today, 29)),
        end: endOfToday(),
      }
    case "last_90_days":
      return {
        start: startOfDay(subDays(today, 89)),
        end: endOfToday(),
      }
    case "last_6_months":
      return {
        start: startOfDay(subMonths(today, 6)),
        end: endOfToday(),
      }
    case "last_year":
      return {
        start: startOfDay(subMonths(today, 12)),
        end: endOfToday(),
      }
    case "all_time":
      return null
    default:
      return null
  }
}

/**
 * Get label for preset
 */
export function getPresetLabel(preset: DateRangePreset): string {
  const labels: Record<DateRangePreset, string> = {
    today: "Today",
    last_7_days: "Last 7 Days",
    last_30_days: "Last 30 Days",
    last_90_days: "Last 90 Days",
    last_6_months: "Last 6 Months",
    last_year: "Last Year",
    all_time: "All Time",
  }
  return labels[preset]
}

/**
 * Convert DateRange to query params
 */
export function dateRangeToQueryParams(dateRange: DateRangeType | null): Record<string, string> {
  if (!dateRange || dateRange.type === "all_time") {
    return {}
  }

  if (dateRange.type === "preset") {
    const range = getPresetDateRange(dateRange.preset)
    if (!range) return {}
    
    return {
      startDate: format(range.start, "yyyy-MM-dd"),
      endDate: format(range.end, "yyyy-MM-dd"),
    }
  }

  // Custom range
  return {
    startDate: format(dateRange.start, "yyyy-MM-dd"),
    endDate: format(dateRange.end, "yyyy-MM-dd"),
  }
}

/**
 * Parse query params to DateRangeType
 */
export function parseDateRangeFromQuery(
  searchParams: URLSearchParams
): DateRangeType | null {
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  const preset = searchParams.get("preset") as DateRangePreset | null

  if (preset && preset !== "all_time") {
    return { type: "preset", preset }
  }

  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      return {
        type: "custom",
        start: startOfDay(start),
        end: endOfDay(end),
      }
    }
  }

  return null
}

/**
 * Format date range for display
 */
export function formatDateRangeLabel(dateRange: DateRangeType | null): string {
  if (!dateRange || dateRange.type === "all_time") {
    return "All Time"
  }

  if (dateRange.type === "preset") {
    return getPresetLabel(dateRange.preset)
  }

  // Custom range
  return `${format(dateRange.start, "MMM d, yyyy")} - ${format(dateRange.end, "MMM d, yyyy")}`
}
