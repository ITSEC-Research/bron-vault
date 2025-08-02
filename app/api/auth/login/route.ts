import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/mysql"
import bcrypt from "bcryptjs"
import type { RowDataPacket } from "mysql2"
import { generateToken, getSecureCookieOptions } from "@/lib/auth"

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  try {
    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT id, email, password_hash, name FROM users WHERE email = ? LIMIT 1",
      [email]
    )

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ success: false, error: "Invalid email or password." }, { status: 401 })
    }

    const user = users[0]

    // Verify password hash
    const match = await bcrypt.compare(password, user.password_hash || "")
    if (!match) {
      return NextResponse.json({ success: false, error: "Invalid email or password." }, { status: 401 })
    }

    // Generate JWT token
    const token = await generateToken({
      userId: String(user.id),
      username: user.name || user.email,
    })

    // Set secure cookie with JWT token
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    })

    response.cookies.set("auth", token, getSecureCookieOptions())

    return response
  } catch (err) {
    console.error("Login error:", err)
    return NextResponse.json({ success: false, error: "Internal server error occurred." }, { status: 500 })
  }
}