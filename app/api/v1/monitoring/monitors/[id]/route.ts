/**
 * Domain Monitor by ID API v1
 * 
 * GET    /api/v1/monitoring/monitors/:id   - Get a specific monitor
 * PUT    /api/v1/monitoring/monitors/:id   - Update a monitor (admin only)
 * DELETE /api/v1/monitoring/monitors/:id   - Delete a monitor (admin only)
 */

import { NextRequest, NextResponse } from "next/server"
import { withApiKeyAuth, addRateLimitHeaders, logApiRequest } from "@/lib/api-key-auth"
import { getMonitor, updateMonitor, deleteMonitor } from "@/lib/domain-monitor"

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/monitoring/monitors/:id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()

  const auth = await withApiKeyAuth(request)
  if (auth.response) return auth.response
  const { payload } = auth

  try {
    const { id } = await params
    const monitorId = parseInt(id)
    if (isNaN(monitorId)) {
      return NextResponse.json(
        { success: false, error: "Invalid monitor ID", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    const monitor = await getMonitor(monitorId)
    if (!monitor) {
      return NextResponse.json(
        { success: false, error: "Monitor not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    const response = NextResponse.json({
      success: true,
      data: monitor,
      meta: { checkedAt: new Date().toISOString() }
    })

    addRateLimitHeaders(response, payload)
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: `/api/v1/monitoring/monitors/${id}`,
      method: 'GET',
      statusCode: 200,
      duration: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return response
  } catch (error) {
    console.error("v1 get monitor error:", error)
    const duration = Date.now() - startTime
    logApiRequest({ apiKeyId: payload.keyId, endpoint: '/api/v1/monitoring/monitors/[id]', method: 'GET', statusCode: 500, duration })
    return NextResponse.json(
      { success: false, error: "Failed to get monitor", code: "INTERNAL_ERROR", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/v1/monitoring/monitors/:id
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()

  const auth = await withApiKeyAuth(request, { requiredRole: 'admin' })
  if (auth.response) return auth.response
  const { payload } = auth

  try {
    const { id } = await params
    const monitorId = parseInt(id)
    if (isNaN(monitorId)) {
      return NextResponse.json(
        { success: false, error: "Invalid monitor ID", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    const existing = await getMonitor(monitorId)
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Monitor not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const updates: any = {}

    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.domains !== undefined) {
      if (!Array.isArray(body.domains) || body.domains.length === 0) {
        return NextResponse.json(
          { success: false, error: "At least one domain is required", code: "VALIDATION_ERROR" },
          { status: 400 }
        )
      }
      updates.domains = body.domains.map((d: string) => d.trim().toLowerCase())
    }
    if (body.match_mode !== undefined) {
      if (!["credential", "url", "both"].includes(body.match_mode)) {
        return NextResponse.json(
          { success: false, error: "match_mode must be 'credential', 'url', or 'both'", code: "VALIDATION_ERROR" },
          { status: 400 }
        )
      }
      updates.match_mode = body.match_mode
    }
    if (body.is_active !== undefined) updates.is_active = body.is_active
    if (body.webhook_ids !== undefined) updates.webhook_ids = body.webhook_ids

    await updateMonitor(monitorId, updates)

    const response = NextResponse.json({
      success: true,
      message: "Monitor updated successfully",
      meta: { updatedAt: new Date().toISOString() }
    })

    addRateLimitHeaders(response, payload)
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: `/api/v1/monitoring/monitors/${id}`,
      method: 'PUT',
      statusCode: 200,
      duration: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return response
  } catch (error) {
    console.error("v1 update monitor error:", error)
    const duration = Date.now() - startTime
    logApiRequest({ apiKeyId: payload.keyId, endpoint: '/api/v1/monitoring/monitors/[id]', method: 'PUT', statusCode: 500, duration })
    return NextResponse.json(
      { success: false, error: "Failed to update monitor", code: "INTERNAL_ERROR", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v1/monitoring/monitors/:id
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()

  const auth = await withApiKeyAuth(request, { requiredRole: 'admin' })
  if (auth.response) return auth.response
  const { payload } = auth

  try {
    const { id } = await params
    const monitorId = parseInt(id)
    if (isNaN(monitorId)) {
      return NextResponse.json(
        { success: false, error: "Invalid monitor ID", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    const existing = await getMonitor(monitorId)
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Monitor not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    await deleteMonitor(monitorId)

    const response = NextResponse.json({
      success: true,
      message: "Monitor deleted successfully",
      meta: { deletedAt: new Date().toISOString() }
    })

    addRateLimitHeaders(response, payload)
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: `/api/v1/monitoring/monitors/${id}`,
      method: 'DELETE',
      statusCode: 200,
      duration: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return response
  } catch (error) {
    console.error("v1 delete monitor error:", error)
    const duration = Date.now() - startTime
    logApiRequest({ apiKeyId: payload.keyId, endpoint: '/api/v1/monitoring/monitors/[id]', method: 'DELETE', statusCode: 500, duration })
    return NextResponse.json(
      { success: false, error: "Failed to delete monitor", code: "INTERNAL_ERROR", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }
}
