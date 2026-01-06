import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2";
import { validateRequest, getUserRole, UserRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  // Use JWT validation instead of direct cookie access
  const user = await validateRequest(request);

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Query includes role field - backwards compatible (returns NULL for old DBs without role column)
    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT id, email, name, role FROM users WHERE id = ? LIMIT 1",
      [user.userId]
    );

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const userData = users[0];
    
    // Get role from database, fallback to JWT payload role, then to 'admin' for backwards compatibility
    const userRole: UserRole = userData.role || getUserRole(user);
    
    return NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name || userData.email.split('@')[0], // Fallback to email prefix if name is null
        role: userRole
      }
    });
  } catch (err) {
    console.error("Get user error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}