import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/mysql"
import bcrypt from "bcryptjs"
import type { RowDataPacket } from "mysql2"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

    // Validate input
    if (!email || !password || !name) {
      return NextResponse.json({ 
        success: false, 
        error: "Email, password, and name are required" 
      }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ 
        success: false, 
        error: "Invalid email format" 
      }, { status: 400 })
    }

    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json({ 
        success: false, 
        error: "Password must be at least 6 characters long" 
      }, { status: 400 })
    }

    // Check if users table exists, create if not
    const [tables] = await pool.query<RowDataPacket[]>(
      "SHOW TABLES LIKE 'users'"
    )

    if (!Array.isArray(tables) || tables.length === 0) {
      // Create users table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(255) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
    }

    // SECURITY CHECK: Ensure no users exist before allowing registration
    const [existingUsers] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM users"
    )

    const userCount = Array.isArray(existingUsers) && existingUsers.length > 0 ? existingUsers[0].count : 0

    if (userCount > 0) {
      return NextResponse.json({ 
        success: false, 
        error: "Registration is only allowed when no users exist. Please use login instead." 
      }, { status: 403 })
    }

    // Check if email already exists (extra safety)
    const [emailCheck] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email]
    )

    if (Array.isArray(emailCheck) && emailCheck.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: "Email already exists" 
      }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create first user
    await pool.query(
      "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)",
      [email, hashedPassword, name]
    )

    console.log("✅ First user created successfully:", email)

    return NextResponse.json({ 
      success: true, 
      message: "First user created successfully. You can now login.",
      user: {
        email: email,
        name: name
      }
    })
  } catch (err) {
    console.error("Register first user error:", err)
    
    // Handle duplicate email error
    if (err instanceof Error && err.message.includes('Duplicate entry')) {
      return NextResponse.json({ 
        success: false, 
        error: "Email already exists" 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      success: false, 
      error: "Failed to create user",
      details: err instanceof Error ? err.message : "Unknown error"
    }, { status: 500 })
  }
}
