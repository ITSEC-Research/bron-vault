/**
 * Test Webhook API v1
 * 
 * POST /api/v1/monitoring/webhooks/:id/test   - Send a test payload to webhook (admin only)
 */

import { NextRequest, NextResponse } from "next/server"
import { withApiKeyAuth, addRateLimitHeaders, logApiRequest } from "@/lib/api-key-auth"
import { testWebhook } from "@/lib/domain-monitor"

export const dynamic = 'force-dynamic'

/**
 * POST /api/v1/monitoring/webhooks/:id/test
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()

  const auth = await withApiKeyAuth(request, { requiredRole: 'admin' })
  if (auth.response) return auth.response
  const { payload } = auth

  try {
    const { id } = await params
    const webhookId = parseInt(id)
    if (isNaN(webhookId)) {
      return NextResponse.json(
        { success: false, error: "Invalid webhook ID", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    const result = await testWebhook(webhookId)

    const response = NextResponse.json({
      success: result.success,
      data: {
        statusCode: result.statusCode,
        error: result.error,
      },
      message: result.success
        ? `Webhook test successful (HTTP ${result.statusCode})`
        : `Webhook test failed: ${result.error}`,
      meta: { testedAt: new Date().toISOString() }
    })

    addRateLimitHeaders(response, payload)
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: `/api/v1/monitoring/webhooks/${id}/test`,
      method: 'POST',
      statusCode: result.success ? 200 : 422,
      duration: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return response
  } catch (error) {
    console.error("v1 test webhook error:", error)
    const duration = Date.now() - startTime
    logApiRequest({ apiKeyId: payload.keyId, endpoint: '/api/v1/monitoring/webhooks/[id]/test', method: 'POST', statusCode: 500, duration })
    return NextResponse.json(
      { success: false, error: "Failed to test webhook", code: "INTERNAL_ERROR", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }
}
