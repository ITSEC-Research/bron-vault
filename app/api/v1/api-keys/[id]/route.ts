/**
 * API Key Individual Management Endpoint
 * 
 * DELETE - Delete/Revoke an API key
 * PATCH - Update API key (activate/deactivate, update name)
 */

import { NextRequest, NextResponse } from "next/server"
import { validateRequest, isAdmin } from "@/lib/auth"
import { deleteApiKey } from "@/lib/api-key-auth"
import { executeQuery } from "@/lib/mysql"

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

/**
 * DELETE /api/v1/api-keys/[id]
 * Delete an API key
 * - Admin: Can delete any API key
 * - Analyst: Can only delete their own API keys
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Validate authentication (session-based, not API key)
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    const keyId = Number(id)

    if (isNaN(keyId) || keyId <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid API key ID" },
        { status: 400 }
      )
    }

    // Admin can delete any key, analyst can only delete their own
    const userId = isAdmin(user) ? undefined : Number(user.userId)
    const deleted = await deleteApiKey(keyId, userId)

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "API key not found or you don't have permission to delete it" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "API key deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting API key:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete API key",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/v1/api-keys/[id]
 * Update an API key (name, active status)
 * - Admin: Can update any API key
 * - Analyst: Can only update their own API keys
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // Validate authentication (session-based, not API key)
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    const keyId = Number(id)

    if (isNaN(keyId) || keyId <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid API key ID" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, isActive, rateLimit, rateLimitWindow } = body

    // Build update query
    const updates: string[] = []
    const values: any[] = []

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: "Name cannot be empty" },
          { status: 400 }
        )
      }
      if (name.length > 255) {
        return NextResponse.json(
          { success: false, error: "Name must be 255 characters or less" },
          { status: 400 }
        )
      }
      updates.push("name = ?")
      values.push(name.trim())
    }

    if (isActive !== undefined) {
      updates.push("is_active = ?")
      values.push(isActive ? 1 : 0)
    }

    if (rateLimit !== undefined) {
      const newRateLimit = Math.min(Math.max(1, Number(rateLimit)), 10000)
      updates.push("rate_limit = ?")
      values.push(newRateLimit)
    }

    if (rateLimitWindow !== undefined) {
      const newWindow = Math.min(Math.max(1, Number(rateLimitWindow)), 3600)
      updates.push("rate_limit_window = ?")
      values.push(newWindow)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update" },
        { status: 400 }
      )
    }

    // Add WHERE clause
    let whereClause = "WHERE id = ?"
    values.push(keyId)

    // Analyst can only update their own keys
    if (!isAdmin(user)) {
      whereClause += " AND user_id = ?"
      values.push(Number(user.userId))
    }

    const query = `UPDATE api_keys SET ${updates.join(", ")} ${whereClause}`
    const result = await executeQuery(query, values) as any

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: "API key not found or you don't have permission to update it" },
        { status: 404 }
      )
    }

    // Get updated record
    const updatedKeys = await executeQuery(
      "SELECT id, name, key_prefix, role, rate_limit, rate_limit_window, is_active, expires_at, last_used_at, created_at, updated_at FROM api_keys WHERE id = ?",
      [keyId]
    ) as any[]
    const updatedKey = updatedKeys[0]

    return NextResponse.json({
      success: true,
      message: "API key updated successfully",
      apiKey: {
        id: updatedKey.id,
        name: updatedKey.name,
        keyPrefix: updatedKey.key_prefix,
        role: updatedKey.role,
        rateLimit: updatedKey.rate_limit,
        rateLimitWindow: updatedKey.rate_limit_window,
        isActive: updatedKey.is_active,
        expiresAt: updatedKey.expires_at,
        lastUsedAt: updatedKey.last_used_at,
        createdAt: updatedKey.created_at,
        updatedAt: updatedKey.updated_at,
      }
    })
  } catch (error) {
    console.error("Error updating API key:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update API key",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
