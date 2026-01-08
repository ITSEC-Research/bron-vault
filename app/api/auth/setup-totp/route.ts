/**
 * API: Setup TOTP
 * Generates a new TOTP secret and QR code for the user
 * Does NOT enable 2FA yet - user must verify first
 */

import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"
import { generateTOTPSecret, generateQRCode, generateBackupCodes } from "@/lib/totp"
import type { RowDataPacket } from "mysql2"

export async function POST(request: NextRequest) {
  // Validate user is authenticated
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get user data
    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT id, email, totp_enabled FROM users WHERE id = ? LIMIT 1",
      [user.userId]
    )

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    const userData = users[0]

    // Check if 2FA is already enabled
    if (userData.totp_enabled) {
      return NextResponse.json({ 
        success: false, 
        error: "2FA is already enabled. Disable it first to generate new secret." 
      }, { status: 400 })
    }

    // Generate new secret
    const secret = generateTOTPSecret()
    
    // Generate QR code
    const qrCode = await generateQRCode(secret, userData.email)
    
    // Generate backup codes
    const backupCodes = generateBackupCodes(10)

    // Store secret temporarily (not enabled yet)
    // User must verify with a code before it's enabled
    await pool.query(
      "UPDATE users SET totp_secret = ?, backup_codes = ? WHERE id = ?",
      [secret, JSON.stringify(backupCodes), user.userId]
    )

    return NextResponse.json({
      success: true,
      data: {
        secret, // Show secret so user can manually enter if QR fails
        qrCode, // Data URL for QR code image
        backupCodes // One-time recovery codes
      }
    })
  } catch (err) {
    console.error("Setup TOTP error:", err)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

// GET: Check if user has 2FA setup
export async function GET(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT totp_enabled, totp_secret IS NOT NULL as has_secret FROM users WHERE id = ? LIMIT 1",
      [user.userId]
    )

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        totpEnabled: Boolean(users[0].totp_enabled),
        hasSecret: Boolean(users[0].has_secret)
      }
    })
  } catch (err) {
    console.error("Get TOTP status error:", err)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
