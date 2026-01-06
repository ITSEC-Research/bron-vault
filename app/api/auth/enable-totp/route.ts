/**
 * API: Enable TOTP
 * Verifies a TOTP code and enables 2FA for the user
 */

import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"
import { verifyTOTP } from "@/lib/totp"
import type { RowDataPacket } from "mysql2"

export async function POST(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const { code } = await request.json()

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ success: false, error: "Verification code is required" }, { status: 400 })
  }

  try {
    // Get user's TOTP secret
    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT id, totp_secret, totp_enabled FROM users WHERE id = ? LIMIT 1",
      [user.userId]
    )

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const userData = users[0]

    if (!userData.totp_secret) {
      return NextResponse.json({ 
        success: false, 
        error: "No TOTP secret found. Please setup 2FA first." 
      }, { status: 400 })
    }

    if (userData.totp_enabled) {
      return NextResponse.json({ 
        success: false, 
        error: "2FA is already enabled" 
      }, { status: 400 })
    }

    // Verify the code
    const isValid = verifyTOTP(userData.totp_secret, code)

    if (!isValid) {
      return NextResponse.json({ 
        success: false, 
        error: "Invalid verification code. Please try again." 
      }, { status: 400 })
    }

    // Enable 2FA
    await pool.query(
      "UPDATE users SET totp_enabled = TRUE WHERE id = ?",
      [user.userId]
    )

    return NextResponse.json({
      success: true,
      message: "Two-factor authentication has been enabled successfully"
    })
  } catch (err) {
    console.error("Enable TOTP error:", err)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
