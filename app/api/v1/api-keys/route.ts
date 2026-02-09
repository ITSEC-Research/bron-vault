/**
 * API Keys Management Endpoint
 * 
 * POST - Create new API key (authenticated users)
 * GET - List API keys (own keys for analysts, all keys for admins)
 */

import { NextRequest, NextResponse } from "next/server"
import { validateRequest, isAdmin } from "@/lib/auth"
import { createApiKey, getApiKeysByUser, getAllApiKeys, ApiKeyRole } from "@/lib/api-key-auth"
import { logApiKeyAction } from "@/lib/audit-log"

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/api-keys
 * List API keys
 * - Admin: Can see all API keys from all users
 * - Analyst: Can only see their own API keys
 */
export async function GET(request: NextRequest) {
  // Validate authentication (session-based, not API key)
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    let apiKeys
    
    if (isAdmin(user)) {
      // Admin can see all API keys
      apiKeys = await getAllApiKeys()
    } else {
      // Analyst can only see their own keys
      apiKeys = await getApiKeysByUser(Number(user.userId))
    }

    return NextResponse.json({
      success: true,
      data: {
        apiKeys: apiKeys.map(key => ({
          id: key.id,
          name: key.name,
          keyPrefix: key.key_prefix,
          role: key.role,
          rateLimit: key.rate_limit,
          rateLimitWindow: key.rate_limit_window,
          isActive: key.is_active,
          expiresAt: key.expires_at,
          lastUsedAt: key.last_used_at,
          createdAt: key.created_at,
          updatedAt: key.updated_at,
          // Only include user info for admin view
          ...(isAdmin(user) && {
            userId: key.user_id,
            userName: key.user_name,
            userEmail: key.user_email,
          })
        }))
      }
    })
  } catch (error) {
    console.error("Error fetching API keys:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch API keys",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/api-keys
 * Create a new API key
 * - Admin: Can create keys with any role
 * - Analyst: Can only create keys with 'analyst' role
 */
export async function POST(request: NextRequest) {
  // Validate authentication (session-based, not API key)
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, role, rateLimit, rateLimitWindow, expiresAt } = body

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "API key name is required" },
        { status: 400 }
      )
    }

    if (name.length > 255) {
      return NextResponse.json(
        { success: false, error: "API key name must be 255 characters or less" },
        { status: 400 }
      )
    }

    // Validate role
    let keyRole: ApiKeyRole = 'analyst'
    if (role) {
      if (role !== 'admin' && role !== 'analyst') {
        return NextResponse.json(
          { success: false, error: "Invalid role. Must be 'admin' or 'analyst'" },
          { status: 400 }
        )
      }
      
      // Only admin can create admin keys
      if (role === 'admin' && !isAdmin(user)) {
        return NextResponse.json(
          { success: false, error: "Only administrators can create API keys with admin role" },
          { status: 403 }
        )
      }
      
      keyRole = role
    }

    // Validate rate limits
    const finalRateLimit = rateLimit ? Math.min(Math.max(1, Number(rateLimit)), 10000) : 100
    const finalRateLimitWindow = rateLimitWindow ? Math.min(Math.max(1, Number(rateLimitWindow)), 3600) : 60

    // Parse expiration date
    let finalExpiresAt: Date | null = null
    if (expiresAt) {
      const parsedDate = new Date(expiresAt)
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          { success: false, error: "Invalid expiration date format" },
          { status: 400 }
        )
      }
      if (parsedDate <= new Date()) {
        return NextResponse.json(
          { success: false, error: "Expiration date must be in the future" },
          { status: 400 }
        )
      }
      finalExpiresAt = parsedDate
    }

    // Create the API key
    const { apiKey, record } = await createApiKey({
      userId: Number(user.userId),
      name: name.trim(),
      role: keyRole,
      rateLimit: finalRateLimit,
      rateLimitWindow: finalRateLimitWindow,
      expiresAt: finalExpiresAt,
    })

    // Log the API key creation in audit log
    await logApiKeyAction(
      'apikey.create',
      { id: Number(user.userId), email: user.email || null },
      record.id,
      { 
        name: record.name,
        role: record.role,
        key_prefix: record.key_prefix,
        expires_at: record.expires_at?.toISOString() || null
      },
      request
    )

    // Return the API key (only shown once!)
    return NextResponse.json({
      success: true,
      message: "API key created successfully. Save this key - it will not be shown again!",
      data: {
        apiKey: apiKey, // Full API key - only shown once
        keyInfo: {
          id: record.id,
          name: record.name,
          keyPrefix: record.key_prefix,
          role: record.role,
          rateLimit: record.rate_limit,
          rateLimitWindow: record.rate_limit_window,
          expiresAt: record.expires_at,
          createdAt: record.created_at,
        }
      }
    })
  } catch (error) {
    console.error("Error creating API key:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create API key",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
