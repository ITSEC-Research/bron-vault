/**
 * Monitor Alerts API v1
 * 
 * GET /api/v1/monitoring/alerts   - List alert history
 */

import { NextRequest, NextResponse } from "next/server"
import { withApiKeyAuth, addRateLimitHeaders, logApiRequest } from "@/lib/api-key-auth"
import { listAlerts } from "@/lib/domain-monitor"

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/monitoring/alerts
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  const auth = await withApiKeyAuth(request)
  if (auth.response) return auth.response
  const { payload } = auth

  try {
    const { searchParams } = new URL(request.url)
    const monitorId = searchParams.get("monitor_id") ? parseInt(searchParams.get("monitor_id")!) : undefined
    const webhookId = searchParams.get("webhook_id") ? parseInt(searchParams.get("webhook_id")!) : undefined
    const status = searchParams.get("status") as 'success' | 'failed' | 'retrying' | undefined
    const limit = Math.min(parseInt(searchParams.get("limit") || "50") || 50, 100)
    const offset = parseInt(searchParams.get("offset") || "0") || 0

    // Validate status if provided
    if (status && !["success", "failed", "retrying"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "status must be 'success', 'failed', or 'retrying'", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    const result = await listAlerts({ monitorId, webhookId, status, limit, offset })

    const response = NextResponse.json({
      success: true,
      data: result.alerts,
      total: result.total,
      meta: { checkedAt: new Date().toISOString() }
    })

    addRateLimitHeaders(response, payload)
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: '/api/v1/monitoring/alerts',
      method: 'GET',
      statusCode: 200,
      duration: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return response
  } catch (error) {
    console.error("v1 list alerts error:", error)
    const duration = Date.now() - startTime
    logApiRequest({ apiKeyId: payload.keyId, endpoint: '/api/v1/monitoring/alerts', method: 'GET', statusCode: 500, duration })
    return NextResponse.json(
      { success: false, error: "Failed to list alerts", code: "INTERNAL_ERROR", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }
}
