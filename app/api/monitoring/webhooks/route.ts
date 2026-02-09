import { NextRequest, NextResponse } from "next/server"
import { validateRequest, requireAdminRole } from "@/lib/auth"
import { createWebhook, listWebhooks } from "@/lib/domain-monitor"

export const dynamic = 'force-dynamic'

/**
 * GET /api/monitoring/webhooks
 * List all webhooks
 */
export async function GET(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("active_only") === "true"
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    const result = await listWebhooks({ activeOnly, limit, offset })

    // Mask webhook URLs for security (show only domain)
    const maskedWebhooks = result.webhooks.map(wh => ({
      ...wh,
      url: maskWebhookUrl(wh.url),
      url_full: wh.url,
      secret: wh.secret ? "••••••••" : null,
    }))

    return NextResponse.json({
      success: true,
      data: maskedWebhooks,
      total: result.total,
    })
  } catch (error) {
    console.error("Error listing webhooks:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to list webhooks" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/monitoring/webhooks
 * Create a new webhook
 */
export async function POST(request: NextRequest) {
  const user = await validateRequest(request)
  const adminError = requireAdminRole(user)
  if (adminError) return adminError

  try {
    const body = await request.json()
    const { name, url, secret, headers } = body

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Webhook name is required" },
        { status: 400 }
      )
    }

    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return NextResponse.json(
        { success: false, error: "Valid webhook URL is required (must start with http/https)" },
        { status: 400 }
      )
    }

    // Validate headers if provided
    if (headers && typeof headers !== "object") {
      return NextResponse.json(
        { success: false, error: "Headers must be a JSON object" },
        { status: 400 }
      )
    }

    const webhookId = await createWebhook({
      name: name.trim(),
      url: url.trim(),
      secret: secret || undefined,
      headers: headers || undefined,
      created_by: user ? parseInt(user.userId) : undefined,
    })

    return NextResponse.json({
      success: true,
      data: { id: webhookId },
      message: "Webhook created successfully",
    })
  } catch (error) {
    console.error("Error creating webhook:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to create webhook" },
      { status: 500 }
    )
  }
}

function maskWebhookUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const pathParts = parsed.pathname.split("/")
    const maskedPath = pathParts.length > 2
      ? pathParts.slice(0, 2).join("/") + "/••••••"
      : parsed.pathname
    return `${parsed.protocol}//${parsed.host}${maskedPath}`
  } catch {
    return "••••••••"
  }
}
