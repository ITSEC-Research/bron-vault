import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/mysql"
import bcrypt from "bcryptjs"
import type { RowDataPacket } from "mysql2"
import { generateToken, generatePending2FAToken, getSecureCookieOptions, isRequestSecure, UserRole } from "@/lib/auth"
import { logUserAction } from "@/lib/audit-log"

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  try {
    // Query includes role, is_active and TOTP fields
    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT id, email, password_hash, name, role, is_active, totp_enabled FROM users WHERE email = ? LIMIT 1",
      [email]
    )

    if (!Array.isArray(users) || users.length === 0) {
      // Log failed login attempt (user not found)
      await logUserAction(
        'user.login.fail',
        { id: null, email: email },
        null,
        { reason: 'user_not_found', attempted_email: email },
        request
      )
      return NextResponse.json({ success: false, error: "Invalid email or password." }, { status: 401 })
    }

    const user = users[0]

    // Verify password hash
    const match = await bcrypt.compare(password, user.password_hash || "")
    if (!match) {
      // Log failed login attempt (wrong password)
      await logUserAction(
        'user.login.fail',
        { id: user.id, email: user.email },
        user.id,
        { reason: 'invalid_password' },
        request
      )
      return NextResponse.json({ success: false, error: "Invalid email or password." }, { status: 401 })
    }

    // Check if user account is active
    if (user.is_active === false || user.is_active === 0) {
      // Log failed login (inactive account)
      await logUserAction(
        'user.login.fail',
        { id: user.id, email: user.email },
        user.id,
        { reason: 'account_inactive' },
        request
      )
      return NextResponse.json({ 
        success: false, 
        error: "Your account has been deactivated. Please contact an administrator." 
      }, { status: 403 })
    }

    // Check if 2FA is enabled
    if (user.totp_enabled) {
      // Generate a secure pending 2FA token that proves password was verified
      // This token is short-lived (5 minutes) and can only be used for 2FA verification
      const pending2FAToken = await generatePending2FAToken(String(user.id))
      
      // SECURITY: Store pending2FAToken in httpOnly cookie instead of response body (HIGH-02)
      const response = NextResponse.json({
        success: true,
        requires2FA: true,
        message: "Please enter your 2FA code"
      })

      response.cookies.set("pending_2fa", pending2FAToken, {
        httpOnly: true,
        secure: isRequestSecure(request),
        sameSite: 'strict',
        path: '/api/auth/verify-totp',
        maxAge: 300, // 5 minutes
      })

      return response
    }

    // Get user role - default to 'analyst' for least privilege
    const userRole: UserRole = user.role || 'analyst'

    // Generate JWT token with role included
    const token = await generateToken({
      userId: String(user.id),
      username: user.name || user.email,
      email: user.email,
      role: userRole,
    })

    // Log successful login (without 2FA)
    await logUserAction(
      'user.login',
      { id: user.id, email: user.email },
      user.id,
      { method: 'password_only', role: userRole },
      request
    )

    // Set secure cookie with JWT token
    const response = NextResponse.json({
      success: true,
      requires2FA: false,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: userRole
      }
    })

    response.cookies.set("auth", token, getSecureCookieOptions(request))

    return response
  } catch (err) {
    console.error("Login error:", err)
    return NextResponse.json({ success: false, error: "Internal server error occurred." }, { status: 500 })
  }
}