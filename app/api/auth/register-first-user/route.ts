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

    // Validate password strength - matches validation.ts requirements (LOW-01)
    if (password.length < 12) {
      return NextResponse.json({ 
        success: false, 
        error: "Password must be at least 12 characters long" 
      }, { status: 400 })
    }
    
    // SECURITY: Check password complexity
    if (!/[A-Z]/.test(password)) {
      return NextResponse.json({ 
        success: false, 
        error: "Password must contain at least one uppercase letter" 
      }, { status: 400 })
    }
    if (!/[a-z]/.test(password)) {
      return NextResponse.json({ 
        success: false, 
        error: "Password must contain at least one lowercase letter" 
      }, { status: 400 })
    }
    if (!/[0-9]/.test(password)) {
      return NextResponse.json({ 
        success: false, 
        error: "Password must contain at least one number" 
      }, { status: 400 })
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return NextResponse.json({ 
        success: false, 
        error: "Password must contain at least one special character" 
      }, { status: 400 })
    }

    // Check if users table exists, create if not
    const [tables] = await pool.query<RowDataPacket[]>(
      "SHOW TABLES LIKE 'users'"
    )

    if (!Array.isArray(tables) || tables.length === 0) {
      // Create users table with role column, totp, and preferences
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(255) DEFAULT NULL,
          role ENUM('admin', 'analyst') NOT NULL DEFAULT 'admin',
          totp_secret VARCHAR(255) DEFAULT NULL,
          totp_enabled BOOLEAN DEFAULT FALSE,
          backup_codes TEXT DEFAULT NULL,
          preferences TEXT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_email (email),
          INDEX idx_users_role (role),
          INDEX idx_totp_enabled (totp_enabled)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
    }

    // SECURITY CHECK: Ensure no users exist before allowing registration
    // Use atomic INSERT...SELECT to prevent race condition (MED-05)
    // If another request created a user between our check and insert, this will insert 0 rows
    const hashedPassword = await bcrypt.hash(password, 12)

    const [insertResult] = await pool.query<RowDataPacket[]>(
      `INSERT INTO users (email, password_hash, name, role)
       SELECT ?, ?, ?, 'admin'
       FROM DUAL
       WHERE NOT EXISTS (SELECT 1 FROM users LIMIT 1)`,
      [email, hashedPassword, name]
    )

    const affectedRows = (insertResult as any).affectedRows || 0

    if (affectedRows === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "Registration is only allowed when no users exist. Please use login instead." 
      }, { status: 403 })
    }

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
