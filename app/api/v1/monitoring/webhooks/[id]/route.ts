/**
 * Monitor Webhook by ID API v1
 * 
 * GET    /api/v1/monitoring/webhooks/:id   - Get a specific webhook
 * PUT    /api/v1/monitoring/webhooks/:id   - Update a webhook (admin only)
 * DELETE /api/v1/monitoring/webhooks/:id   - Delete a webhook (admin only)
 */

import { NextRequest, NextResponse } from "next/server"
import { withApiKeyAuth, addRateLimitHeaders, logApiRequest } from "@/lib/api-key-auth"
import { getWebhook, updateWebhook, deleteWebhook } from "@/lib/domain-monitor"

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/monitoring/webhooks/:id
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
    const webhookId = parseInt(id)
    if (isNaN(webhookId)) {
      return NextResponse.json(
        { success: false, error: "Invalid webhook ID", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    const webhook = await getWebhook(webhookId)
    if (!webhook) {
      return NextResponse.json(
        { success: false, error: "Webhook not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    // Mask secret in response
    const data = {
      ...webhook,
      secret: webhook.secret ? "********" : null,
    }

    const response = NextResponse.json({
      success: true,
      data,
      meta: { checkedAt: new Date().toISOString() }
    })

    addRateLimitHeaders(response, payload)
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: `/api/v1/monitoring/webhooks/${id}`,
      method: 'GET',
      statusCode: 200,
      duration: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return response
  } catch (error) {
    console.error("v1 get webhook error:", error)
    const duration = Date.now() - startTime
    logApiRequest({ apiKeyId: payload.keyId, endpoint: '/api/v1/monitoring/webhooks/[id]', method: 'GET', statusCode: 500, duration })
    return NextResponse.json(
      { success: false, error: "Failed to get webhook", code: "INTERNAL_ERROR", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/v1/monitoring/webhooks/:id
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
    const webhookId = parseInt(id)
    if (isNaN(webhookId)) {
      return NextResponse.json(
        { success: false, error: "Invalid webhook ID", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    const existing = await getWebhook(webhookId)
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Webhook not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const updates: any = {}

    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.url !== undefined) {
      if (!body.url.startsWith("http")) {
        return NextResponse.json(
          { success: false, error: "Valid URL is required (must start with http/https)", code: "VALIDATION_ERROR" },
          { status: 400 }
        )
      }
      updates.url = body.url.trim()
    }
    if (body.secret !== undefined) updates.secret = body.secret || null
    if (body.headers !== undefined) updates.headers = body.headers || null
    if (body.is_active !== undefined) updates.is_active = body.is_active

    await updateWebhook(webhookId, updates)

    const response = NextResponse.json({
      success: true,
      message: "Webhook updated successfully",
      meta: { updatedAt: new Date().toISOString() }
    })

    addRateLimitHeaders(response, payload)
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: `/api/v1/monitoring/webhooks/${id}`,
      method: 'PUT',
      statusCode: 200,
      duration: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return response
  } catch (error) {
    console.error("v1 update webhook error:", error)
    const duration = Date.now() - startTime
    logApiRequest({ apiKeyId: payload.keyId, endpoint: '/api/v1/monitoring/webhooks/[id]', method: 'PUT', statusCode: 500, duration })
    return NextResponse.json(
      { success: false, error: "Failed to update webhook", code: "INTERNAL_ERROR", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v1/monitoring/webhooks/:id
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
    const webhookId = parseInt(id)
    if (isNaN(webhookId)) {
      return NextResponse.json(
        { success: false, error: "Invalid webhook ID", code: "VALIDATION_ERROR" },
        { status: 400 }
      )
    }

    const existing = await getWebhook(webhookId)
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Webhook not found", code: "NOT_FOUND" },
        { status: 404 }
      )
    }

    await deleteWebhook(webhookId)

    const response = NextResponse.json({
      success: true,
      message: "Webhook deleted successfully",
      meta: { deletedAt: new Date().toISOString() }
    })

    addRateLimitHeaders(response, payload)
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: `/api/v1/monitoring/webhooks/${id}`,
      method: 'DELETE',
      statusCode: 200,
      duration: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return response
  } catch (error) {
    console.error("v1 delete webhook error:", error)
    const duration = Date.now() - startTime
    logApiRequest({ apiKeyId: payload.keyId, endpoint: '/api/v1/monitoring/webhooks/[id]', method: 'DELETE', statusCode: 500, duration })
    return NextResponse.json(
      { success: false, error: "Failed to delete webhook", code: "INTERNAL_ERROR", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }
}
