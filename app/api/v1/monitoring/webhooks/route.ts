/**
 * Monitor Webhooks API v1
 * 
 * GET  /api/v1/monitoring/webhooks          - List all webhooks
 * POST /api/v1/monitoring/webhooks          - Create a new webhook (admin only)
 */

import { NextRequest, NextResponse } from "next/server"
import { withApiKeyAuth, addRateLimitHeaders, logApiRequest } from "@/lib/api-key-auth"
import { listWebhooks, createWebhook } from "@/lib/domain-monitor"

export const dynamic = 'force-dynamic'

function maskWebhookUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const pathParts = parsed.pathname.split("/")
    const maskedPath = pathParts.length > 2
      ? pathParts.slice(0, 2).join("/") + "/******"
      : parsed.pathname
    return `${parsed.protocol}//${parsed.host}${maskedPath}`
  } catch {
    return "********"
  }
}

/**
 * GET /api/v1/monitoring/webhooks
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

    const result = await listWebhooks({ activeOnly, limit, offset })

    const maskedWebhooks = result.webhooks.map(wh => ({
      ...wh,
      url: maskWebhookUrl(wh.url),
      url_full: wh.url,
      secret: wh.secret ? "********" : null,
    }))

    const response = NextResponse.json({
      success: true,
      data: maskedWebhooks,
      total: result.total,
      meta: { checkedAt: new Date().toISOString() }
    })

    addRateLimitHeaders(response, payload)
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: '/api/v1/monitoring/webhooks',
      method: 'GET',
      statusCode: 200,
      duration: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return response
  } catch (error) {
    console.error("v1 list webhooks error:", error)
    const duration = Date.now() - startTime
    logApiRequest({ apiKeyId: payload.keyId, endpoint: '/api/v1/monitoring/webhooks', method: 'GET', statusCode: 500, duration })
    return NextResponse.json(
      { success: false, error: "Failed to list webhooks", code: "INTERNAL_ERROR", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/monitoring/webhooks
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  const auth = await withApiKeyAuth(request, { requiredRole: 'admin' })
  if (auth.response) return auth.response
  const { payload } = auth

  try {
    const body = await request.json()
    const { name, url, secret, headers } = body

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Webhook name is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return NextResponse.json(
        { success: false, error: "Valid webhook URL is required (must start with http/https)", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    if (headers && typeof headers !== "object") {
      return NextResponse.json(
        { success: false, error: "Headers must be a JSON object", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    const webhookId = await createWebhook({
      name: name.trim(),
      url: url.trim(),
      secret: secret || undefined,
      headers: headers || undefined,
      created_by: parseInt(payload.userId),
    })

    const response = NextResponse.json({
      success: true,
      data: { id: webhookId },
      message: "Webhook created successfully",
      meta: { createdAt: new Date().toISOString() }
    }, { status: 201 })

    addRateLimitHeaders(response, payload)
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: '/api/v1/monitoring/webhooks',
      method: 'POST',
      statusCode: 201,
      duration: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return response
  } catch (error) {
    console.error("v1 create webhook error:", error)
    const duration = Date.now() - startTime
    logApiRequest({ apiKeyId: payload.keyId, endpoint: '/api/v1/monitoring/webhooks', method: 'POST', statusCode: 500, duration })
    return NextResponse.json(
      { success: false, error: "Failed to create webhook", code: "INTERNAL_ERROR", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }
}
