import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/mysql"
import { validateRequest, requireAdminRole } from "@/lib/auth"
import type { RowDataPacket } from "mysql2"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

interface AuditLogRow extends RowDataPacket {
  id: number
  user_id: number | null
  user_email: string | null
  action: string
  resource_type: string
  resource_id: string | null
  details: string
  ip_address: string | null
  user_agent: string | null
  created_at: Date
}

/**
 * GET /api/audit-logs
 * Get audit logs with pagination and filtering (admin only)
 */
export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  // Check admin role - only admins can view audit logs
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
    const action = searchParams.get("action")
    const resourceType = searchParams.get("resource_type")
    const userId = searchParams.get("user_id")
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")
    const search = searchParams.get("search")
    
    // Build WHERE clause
    const conditions: string[] = []
    const params: (string | number)[] = []
    
    if (action) {
      conditions.push("action = ?")
      params.push(action)
    }
    
    if (resourceType) {
      conditions.push("resource_type = ?")
      params.push(resourceType)
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
      conditions.push("(user_email LIKE ? OR resource_id LIKE ? OR details LIKE ?)")
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern)
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
    
    // Get total count
    const [countResult] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
      params
    )
    const total = countResult[0]?.total || 0
    
    // Get audit logs
    const [logs] = await pool.query<AuditLogRow[]>(
      `SELECT id, user_id, user_email, action, resource_type, resource_id, details, ip_address, user_agent, created_at
       FROM audit_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )
    
    // Parse JSON details
    const parsedLogs = logs.map(log => ({
      ...log,
      details: (() => {
        try {
          return JSON.parse(log.details || '{}')
        } catch {
          return {}
        }
      })()
    }))
    
    return NextResponse.json({
      success: true,
      logs: parsedLogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (err) {
    console.error("Get audit logs error:", err)
    return NextResponse.json({ success: false, error: "Failed to fetch audit logs" }, { status: 500 })
  }
}

/**
 * GET /api/audit-logs/actions
 * Get distinct action types for filtering
 */
export async function OPTIONS(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  // Check admin role
  const roleError = requireAdminRole(user)
  if (roleError) {
    return roleError
  }

  try {
    const [actions] = await pool.query<RowDataPacket[]>(
      "SELECT DISTINCT action FROM audit_logs ORDER BY action"
    )
    
    const [resourceTypes] = await pool.query<RowDataPacket[]>(
      "SELECT DISTINCT resource_type FROM audit_logs ORDER BY resource_type"
    )
    
    return NextResponse.json({
      success: true,
      actions: actions.map(a => a.action),
      resourceTypes: resourceTypes.map(r => r.resource_type)
    })
  } catch (err) {
    console.error("Get audit log options error:", err)
    return NextResponse.json({ success: false, error: "Failed to fetch options" }, { status: 500 })
  }
}
