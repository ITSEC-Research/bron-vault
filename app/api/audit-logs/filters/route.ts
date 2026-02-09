import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/mysql"
import { validateRequest, requireAdminRole } from "@/lib/auth"
import type { RowDataPacket } from "mysql2"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/audit-logs/filters
 * Get distinct action types and resource types for filtering
 */
export async function GET(request: NextRequest) {
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
    
    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT DISTINCT user_id, user_email FROM audit_logs WHERE user_id IS NOT NULL ORDER BY user_email"
    )
    
    return NextResponse.json({
      success: true,
      actions: actions.map(a => a.action),
      resourceTypes: resourceTypes.map(r => r.resource_type),
      users: users.map(u => ({ id: u.user_id, email: u.user_email }))
    })
  } catch (err) {
    console.error("Get audit log filters error:", err)
    return NextResponse.json({ success: false, error: "Failed to fetch filters" }, { status: 500 })
  }
}
