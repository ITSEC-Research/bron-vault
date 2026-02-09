import { NextRequest, NextResponse } from "next/server"
import { validateRequest, requireAdminRole } from "@/lib/auth"
import { getWebhook, updateWebhook, deleteWebhook } from "@/lib/domain-monitor"

export const dynamic = 'force-dynamic'

/**
 * GET /api/monitoring/webhooks/[id]
 * Get a specific webhook
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    const webhookId = parseInt(id)
    if (isNaN(webhookId)) {
      return NextResponse.json({ success: false, error: "Invalid webhook ID" }, { status: 400 })
    }

    const webhook = await getWebhook(webhookId)
    if (!webhook) {
      return NextResponse.json({ success: false, error: "Webhook not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: webhook })
  } catch (error) {
    console.error("Error getting webhook:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to get webhook" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/monitoring/webhooks/[id]
 * Update a webhook
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await validateRequest(request)
  const adminError = requireAdminRole(user)
  if (adminError) return adminError

  try {
    const { id } = await params
    const webhookId = parseInt(id)
    if (isNaN(webhookId)) {
      return NextResponse.json({ success: false, error: "Invalid webhook ID" }, { status: 400 })
    }

    const existing = await getWebhook(webhookId)
    if (!existing) {
      return NextResponse.json({ success: false, error: "Webhook not found" }, { status: 404 })
    }

    const body = await request.json()
    const updates: any = {}

    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.url !== undefined) {
      if (!body.url.startsWith("http")) {
        return NextResponse.json(
          { success: false, error: "Valid URL is required" },
          { status: 400 }
        )
      }
      updates.url = body.url.trim()
    }
    if (body.secret !== undefined) updates.secret = body.secret || null
    if (body.headers !== undefined) updates.headers = body.headers || null
    if (body.is_active !== undefined) updates.is_active = body.is_active

    await updateWebhook(webhookId, updates)

    return NextResponse.json({
      success: true,
      message: "Webhook updated successfully",
    })
  } catch (error) {
    console.error("Error updating webhook:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update webhook" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/monitoring/webhooks/[id]
 * Delete a webhook
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await validateRequest(request)
  const adminError = requireAdminRole(user)
  if (adminError) return adminError

  try {
    const { id } = await params
    const webhookId = parseInt(id)
    if (isNaN(webhookId)) {
      return NextResponse.json({ success: false, error: "Invalid webhook ID" }, { status: 400 })
    }

    const existing = await getWebhook(webhookId)
    if (!existing) {
      return NextResponse.json({ success: false, error: "Webhook not found" }, { status: 404 })
    }

    await deleteWebhook(webhookId)

    return NextResponse.json({
      success: true,
      message: "Webhook deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting webhook:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to delete webhook" },
      { status: 500 }
    )
  }
}
