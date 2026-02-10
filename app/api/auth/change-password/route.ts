import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/mysql";
import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2";
import { validateRequest } from "@/lib/auth";
import { passwordSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const { currentPassword, newPassword } = await request.json();

  // Use JWT validation instead of direct cookie access
  const user = await validateRequest(request);

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // SECURITY: Validate new password strength (MED-01)
  const passwordValidation = passwordSchema.safeParse(newPassword);
  if (!passwordValidation.success) {
    return NextResponse.json(
      { success: false, error: passwordValidation.error.errors.map(e => e.message).join(", ") },
      { status: 400 }
    );
  }

  try {
    // Get current user data
    const [users] = await pool.query<RowDataPacket[]>(
      "SELECT id, password_hash FROM users WHERE id = ? LIMIT 1",
      [user.userId]
    );

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const userData = users[0];

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userData.password_hash);
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ success: false, error: "Current password is incorrect" }, { status: 400 });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await pool.query(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [newPasswordHash, user.userId]
    );

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
} 