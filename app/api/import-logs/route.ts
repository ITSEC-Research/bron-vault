import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/mysql"
import { executeQuery as executeClickHouseQuery } from "@/lib/clickhouse"
import { validateRequest, requireAdminRole } from "@/lib/auth"
import type { RowDataPacket } from "mysql2"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface ImportLogRow extends RowDataPacket {
  id: number
  job_id: string
  user_id: number | null
  user_email: string | null
  api_key_id: number | null
  source: 'web' | 'api'
  filename: string | null
  file_size: number | null
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  total_devices: number
  processed_devices: number
  total_credentials: number
  total_files: number
  error_message: string | null
  started_at: Date | null
  completed_at: Date | null
  created_at: Date
  updated_at: Date
}

/**
 * GET /api/import-logs
 * Get import logs with pagination and filtering (admin only)
 */
export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  // Check admin role - only admins can view import logs
  const roleError = requireAdminRole(user)
  if (roleError) {
    return roleError
  }

  try {
    const { searchParams } = new URL(request.url)
    
    // Pagination
    const page = Math.max(1, Number(searchParams.get("page")) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50))
    const offset = (page - 1) * limit
    
    // Filters
    const source = searchParams.get("source")
    const status = searchParams.get("status")
    const userId = searchParams.get("user_id")
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")
    const search = searchParams.get("search")
    
    // Build WHERE clause
    const conditions: string[] = []
    const params: (string | number)[] = []
    
    if (source) {
      conditions.push("source = ?")
      params.push(source)
    }
    
    if (status) {
      conditions.push("status = ?")
      params.push(status)
    }
    
    if (userId) {
      conditions.push("user_id = ?")
      params.push(Number(userId))
    }
    
    if (startDate) {
      conditions.push("created_at >= ?")
      params.push(startDate)
    }
    
    if (endDate) {
      conditions.push("created_at <= ?")
      params.push(endDate)
    }
    
    if (search) {
      conditions.push("(user_email LIKE ? OR filename LIKE ? OR job_id LIKE ?)")
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern)
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
    
    // Get total count
    const [countResult] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM import_logs ${whereClause}`,
      params
    )
    const total = countResult[0]?.total || 0
    
    // Get import logs with API key name if available
    const [logs] = await pool.query<ImportLogRow[]>(
      `SELECT il.*, ak.name as api_key_name
       FROM import_logs il
       LEFT JOIN api_keys ak ON il.api_key_id = ak.id
       ${whereClause}
       ORDER BY il.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )
    
    // Calculate statistics from import_logs (MySQL)
    const [importStats] = await pool.query<RowDataPacket[]>(
      `SELECT 
        COUNT(*) as total_imports,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_imports,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_imports,
        SUM(CASE WHEN source = 'web' THEN 1 ELSE 0 END) as web_imports,
        SUM(CASE WHEN source = 'api' THEN 1 ELSE 0 END) as api_imports
       FROM import_logs`
    )
    
    // Get actual device/credentials/files counts from ClickHouse (same as dashboard)
    // This ensures consistency between dashboard and import logs
    let totalDevices = 0
    let totalCredentials = 0
    let totalFiles = 0
    
    try {
      // Query devices count (same as dashboard)
      const deviceStatsResult = (await executeClickHouseQuery(`
        SELECT count() as total_devices
        FROM devices
      `)) as any[]
      
      if (deviceStatsResult && deviceStatsResult.length > 0) {
        totalDevices = Number(deviceStatsResult[0]?.total_devices) || 0
      }
      
      // Query total credentials from devices table (aggregated sum, same as dashboard)
      const credentialsStatsResult = (await executeClickHouseQuery(`
        SELECT sum(total_credentials) as total_credentials
        FROM devices
      `)) as any[]
      
      if (credentialsStatsResult && credentialsStatsResult.length > 0) {
        totalCredentials = Number(credentialsStatsResult[0]?.total_credentials) || 0
      }
      
      // Query total files count (same as dashboard)
      const filesStatsResult = (await executeClickHouseQuery(`
        SELECT count() as total_files
        FROM files
        WHERE is_directory = 0
      `)) as any[]
      
      if (filesStatsResult && filesStatsResult.length > 0) {
        totalFiles = Number(filesStatsResult[0]?.total_files) || 0
      }
    } catch (clickhouseError) {
      console.error("Error querying ClickHouse for stats:", clickhouseError)
      // Continue with 0 values if ClickHouse query fails
    }
    
    const stats = {
      ...(importStats[0] || {}),
      total_devices: totalDevices,
      total_credentials: totalCredentials,
      total_files: totalFiles
    }
    
    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats
    })
  } catch (err) {
    console.error("Get import logs error:", err)
    return NextResponse.json({ success: false, error: "Failed to fetch import logs" }, { status: 500 })
  }
}
