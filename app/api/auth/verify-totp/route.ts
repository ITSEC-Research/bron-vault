/**
 * API: Verify TOTP
 * Verifies TOTP code during login (when 2FA is enabled)
 * Also supports backup codes
 * 
 * SECURITY: Requires a valid pending2FAToken that proves the user
 * has already passed password authentication. This prevents attackers
 * from bypassing password authentication by directly calling this endpoint.
 */

import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/mysql"
import { generateToken, getSecureCookieOptions, UserRole, verifyPending2FAToken } from "@/lib/auth"
import { verifyTOTP, verifyBackupCode } from "@/lib/totp"
import type { RowDataPacket } from "mysql2"

export async function POST(request: NextRequest) {
  const { pending2FAToken, code, isBackupCode } = await request.json()

  // SECURITY: Validate pending 2FA token instead of accepting userId directly
  // This ensures the user has already passed password authentication
  if (!pending2FAToken || !code) {
    return NextResponse.json({ 
      success: false, 
      error: "Pending 2FA token and verification code are required" 
    }, { status: 400 })
  }

  // Verify the pending 2FA token
  const userId = await verifyPending2FAToken(pending2FAToken)
  if (!userId) {
    return NextResponse.json({ 
      success: false, 
      error: "Invalid or expired 2FA session. Please login again." 
    }, { status: 401 })
  }

  try {
    // Get user data
    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT id, email, name, role, totp_secret, totp_enabled, backup_codes FROM users WHERE id = ? LIMIT 1",
      [userId]
    )

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const userData = users[0]

    if (!userData.totp_enabled || !userData.totp_secret) {
      return NextResponse.json({ 
        success: false, 
        error: "2FA is not enabled for this user" 
      }, { status: 400 })
    }

    let isValid = false

    if (isBackupCode) {
      // Verify backup code
      const backupCodes: string[] = userData.backup_codes 
        ? JSON.parse(userData.backup_codes) 
        : []
      
      const result = verifyBackupCode(backupCodes, code)
      isValid = result.isValid

      if (isValid) {
        // Update remaining backup codes
        await pool.query(
          "UPDATE users SET backup_codes = ? WHERE id = ?",
          [JSON.stringify(result.remainingCodes), userId]
        )
      }
    } else {
      // Verify TOTP code
      isValid = verifyTOTP(userData.totp_secret, code)
    }

    if (!isValid) {
      return NextResponse.json({ 
        success: false, 
        error: isBackupCode ? "Invalid backup code" : "Invalid verification code" 
      }, { status: 400 })
    }

    // Generate JWT token
    const userRole: UserRole = userData.role || 'admin'
    const token = await generateToken({
      userId: String(userData.id),
      username: userData.name || userData.email,
      role: userRole,
    })

    // Set secure cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userRole
      }
    })

    response.cookies.set("auth", token, getSecureCookieOptions())

    return response
  } catch (err) {
    console.error("Verify TOTP error:", err)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
