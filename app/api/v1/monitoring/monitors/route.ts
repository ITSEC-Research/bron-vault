/**
 * Domain Monitors API v1
 * 
 * GET  /api/v1/monitoring/monitors          - List all domain monitors
 * POST /api/v1/monitoring/monitors          - Create a new domain monitor (admin only)
 */

import { NextRequest, NextResponse } from "next/server"
import { withApiKeyAuth, addRateLimitHeaders, logApiRequest } from "@/lib/api-key-auth"
import { listMonitors, createMonitor } from "@/lib/domain-monitor"

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/monitoring/monitors
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  const auth = await withApiKeyAuth(request)
  if (auth.response) return auth.response
  const { payload } = auth

  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("active_only") === "true"
    const limit = Math.min(parseInt(searchParams.get("limit") || "50") || 50, 100)
    const offset = parseInt(searchParams.get("offset") || "0") || 0

    const result = await listMonitors({ activeOnly, limit, offset })

    const response = NextResponse.json({
      success: true,
      data: result.monitors,
      total: result.total,
      meta: { checkedAt: new Date().toISOString() }
    })

    addRateLimitHeaders(response, payload)
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: '/api/v1/monitoring/monitors',
      method: 'GET',
      statusCode: 200,
      duration: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return response
  } catch (error) {
    console.error("v1 list monitors error:", error)
    const duration = Date.now() - startTime
    logApiRequest({ apiKeyId: payload.keyId, endpoint: '/api/v1/monitoring/monitors', method: 'GET', statusCode: 500, duration })
    return NextResponse.json(
      { success: false, error: "Failed to list monitors", code: "INTERNAL_ERROR", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/monitoring/monitors
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  const auth = await withApiKeyAuth(request, { requiredRole: 'admin' })
  if (auth.response) return auth.response
  const { payload } = auth

  try {
    const body = await request.json()
    const { name, domains, match_mode, webhook_ids } = body

    // Validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Monitor name is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one domain is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    if (!["credential", "url", "both"].includes(match_mode)) {
      return NextResponse.json(
        { success: false, error: "match_mode must be 'credential', 'url', or 'both'", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    const monitorId = await createMonitor({
      name: name.trim(),
      domains: domains.map((d: string) => d.trim().toLowerCase()),
      match_mode,
      webhook_ids: webhook_ids || [],
      created_by: parseInt(payload.userId),
    })

    const response = NextResponse.json({
      success: true,
      data: { id: monitorId },
      message: "Monitor created successfully",
      meta: { createdAt: new Date().toISOString() }
    }, { status: 201 })

    addRateLimitHeaders(response, payload)
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: '/api/v1/monitoring/monitors',
      method: 'POST',
      statusCode: 201,
      duration: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return response
  } catch (error) {
    console.error("v1 create monitor error:", error)
    const duration = Date.now() - startTime
    logApiRequest({ apiKeyId: payload.keyId, endpoint: '/api/v1/monitoring/monitors', method: 'POST', statusCode: 500, duration })
    return NextResponse.json(
      { success: false, error: "Failed to create monitor", code: "INTERNAL_ERROR", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }
}
