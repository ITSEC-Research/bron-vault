/**
 * API: Disable TOTP
 * Disables 2FA for the user (requires current password for security)
 */

import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"
import bcrypt from "bcryptjs"
import type { RowDataPacket } from "mysql2"

export async function POST(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const { password } = await request.json()

  if (!password) {
    return NextResponse.json({ success: false, error: "Password is required" }, { status: 400 })
  }

  try {
    // Get user data with password hash
    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT id, password_hash, totp_enabled FROM users WHERE id = ? LIMIT 1",
      [user.userId]
    )

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const userData = users[0]

    if (!userData.totp_enabled) {
      return NextResponse.json({ 
        success: false, 
        error: "2FA is not enabled" 
      }, { status: 400 })
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, userData.password_hash)
    if (!isPasswordValid) {
      return NextResponse.json({ 
        success: false, 
        error: "Invalid password" 
      }, { status: 400 })
    }

    // Disable 2FA and clear secret/backup codes
    await pool.query(
      "UPDATE users SET totp_enabled = FALSE, totp_secret = NULL, backup_codes = NULL WHERE id = ?",
      [user.userId]
    )

    return NextResponse.json({
      success: true,
      message: "Two-factor authentication has been disabled"
    })
  } catch (err) {
    console.error("Disable TOTP error:", err)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
