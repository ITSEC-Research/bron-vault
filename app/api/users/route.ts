import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/mysql"
import bcrypt from "bcryptjs"
import type { RowDataPacket, ResultSetHeader } from "mysql2"
import { validateRequest, requireAdminRole, UserRole } from "@/lib/auth"

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * GET /api/users
 * Get all users (admin only)
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
    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT id, email, name, role, created_at, updated_at FROM users ORDER BY created_at DESC"
    )

    return NextResponse.json({
      success: true,
      users: users || []
    })
  } catch (err) {
    console.error("Get users error:", err)
    return NextResponse.json({ success: false, error: "Failed to fetch users" }, { status: 500 })
  }
}

/**
 * POST /api/users
 * Create a new user (admin only)
 */
export async function POST(request: NextRequest) {
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
    const { email, password, name, role } = await request.json()

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

    // Validate role
    const validRoles: UserRole[] = ['admin', 'analyst']
    const userRole: UserRole = validRoles.includes(role) ? role : 'analyst'

    // Check if email already exists
    const [existingUsers] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email]
    )

    if (Array.isArray(existingUsers) && existingUsers.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: "Email already exists" 
      }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)",
      [email, hashedPassword, name, userRole]
    )

    console.log("✅ User created successfully:", email, "with role:", userRole)

    return NextResponse.json({ 
      success: true, 
      message: "User created successfully",
      user: {
        id: result.insertId,
        email,
        name,
        role: userRole
      }
    })
  } catch (err) {
    console.error("Create user error:", err)
    return NextResponse.json({ success: false, error: "Failed to create user" }, { status: 500 })
  }
}

/**
 * PUT /api/users
 * Update a user (admin only)
 */
export async function PUT(request: NextRequest) {
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
    const { id, email, name, role, password } = await request.json()

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: "User ID is required" 
      }, { status: 400 })
    }

    // Check if user exists
    const [existingUsers] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE id = ? LIMIT 1",
      [id]
    )

    if (!Array.isArray(existingUsers) || existingUsers.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "User not found" 
      }, { status: 404 })
    }

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []

    if (email) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json({ 
          success: false, 
          error: "Invalid email format" 
        }, { status: 400 })
      }

      // Check if email is used by another user
      const [emailCheck] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1",
        [email, id]
      )
      if (Array.isArray(emailCheck) && emailCheck.length > 0) {
        return NextResponse.json({ 
          success: false, 
          error: "Email already in use by another user" 
        }, { status: 400 })
      }

      updates.push("email = ?")
      values.push(email)
    }

    if (name) {
      updates.push("name = ?")
      values.push(name)
    }

    if (role) {
      const validRoles: UserRole[] = ['admin', 'analyst']
      if (!validRoles.includes(role)) {
        return NextResponse.json({ 
          success: false, 
          error: "Invalid role. Must be 'admin' or 'analyst'" 
        }, { status: 400 })
      }
      updates.push("role = ?")
      values.push(role)
    }

    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ 
          success: false, 
          error: "Password must be at least 6 characters long" 
        }, { status: 400 })
      }
      const hashedPassword = await bcrypt.hash(password, 12)
      updates.push("password_hash = ?")
      values.push(hashedPassword)
    }

    if (updates.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "No fields to update" 
      }, { status: 400 })
    }

    values.push(id)
    await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      values
    )

    console.log("✅ User updated successfully:", id)

    return NextResponse.json({ 
      success: true, 
      message: "User updated successfully"
    })
  } catch (err) {
    console.error("Update user error:", err)
    return NextResponse.json({ success: false, error: "Failed to update user" }, { status: 500 })
  }
}

/**
 * DELETE /api/users
 * Delete a user (admin only)
 */
export async function DELETE(request: NextRequest) {
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
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: "User ID is required" 
      }, { status: 400 })
    }

    // Prevent self-deletion
    if (String(id) === user.userId) {
      return NextResponse.json({ 
        success: false, 
        error: "You cannot delete your own account" 
      }, { status: 400 })
    }

    // Check if user exists
    const [existingUsers] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM users WHERE id = ? LIMIT 1",
      [id]
    )

    if (!Array.isArray(existingUsers) || existingUsers.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "User not found" 
      }, { status: 404 })
    }

    // Check if this is the last admin
    const [adminCount] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
    )
    
    const [userToDelete] = await pool.query<RowDataPacket[]>(
      "SELECT role FROM users WHERE id = ? LIMIT 1",
      [id]
    )

    if (
      Array.isArray(adminCount) && adminCount.length > 0 && 
      adminCount[0].count <= 1 &&
      Array.isArray(userToDelete) && userToDelete.length > 0 &&
      userToDelete[0].role === 'admin'
    ) {
      return NextResponse.json({ 
        success: false, 
        error: "Cannot delete the last admin user" 
      }, { status: 400 })
    }

    // Delete user
    await pool.query("DELETE FROM users WHERE id = ?", [id])

    console.log("✅ User deleted successfully:", id)

    return NextResponse.json({ 
      success: true, 
      message: "User deleted successfully"
    })
  } catch (err) {
    console.error("Delete user error:", err)
    return NextResponse.json({ success: false, error: "Failed to delete user" }, { status: 500 })
  }
}
