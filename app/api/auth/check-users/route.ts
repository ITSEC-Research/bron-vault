import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/mysql"
import type { RowDataPacket } from "mysql2"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  console.log("🔍 [PRODUCTION] Check users endpoint called")
  try {
    // Check if users table exists
    const [tables] = await pool.query<RowDataPacket[]>(
      "SHOW TABLES LIKE 'users'"
    )

    if (!Array.isArray(tables) || tables.length === 0) {
      // Users table doesn't exist, return 0 users
      return NextResponse.json({
        success: true,
        userCount: 0,
        needsInitialSetup: true
      })
    }

    // Count total users
    const [result] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM users"
    )

    const userCount = Array.isArray(result) && result.length > 0 ? result[0].count : 0

    return NextResponse.json({
      success: true,
      userCount: userCount,
      needsInitialSetup: userCount === 0
    })
  } catch (err) {
    console.error("Check users error:", err)
    return NextResponse.json({
      success: false,
      error: "Failed to check users",
      userCount: 0,
      needsInitialSetup: true
    }, { status: 500 })
  }
}
