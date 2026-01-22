import { DateRangeType } from "./date-range-utils"

export interface DashboardExportData {
  stats: {
    totalDevices: number
    uniqueDeviceNames: number
    duplicateDeviceNames: number
    totalFiles: number
    totalCredentials: number
    totalDomains: number
    totalUrls: number
  }
  topPasswords: Array<{ password: string; total_count: number }>
  topTLDs: Array<{ tld: string; count: number }>
  browserData: Array<{ browser: string; count: number }>
  softwareData: Array<{ software_name: string; version: string | null; count: number }>
  countryStats?: {
    summary: {
      totalDevices: number
      totalCredentials: number
      affectedCountries: number
    }
    topCountries: Array<{
      country: string
      countryName: string
      totalDevices: number
      totalCredentials: number
    }>
  }
  dateRange: DateRangeType | null
  exportDate: Date
}
