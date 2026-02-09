import { NextRequest, NextResponse } from "next/server"
import { validateRequest, requireAdminRole } from "@/lib/auth"
import { testWebhook } from "@/lib/domain-monitor"

/**
 * POST /api/monitoring/webhooks/[id]/test
 * Test a webhook by sending a sample payload
 */
export async function POST(
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

    const result = await testWebhook(webhookId)

    return NextResponse.json({
      success: result.success,
      data: {
        statusCode: result.statusCode,
        error: result.error,
      },
      message: result.success
        ? `Webhook test successful (HTTP ${result.statusCode})`
        : `Webhook test failed: ${result.error}`,
    })
  } catch (error) {
    console.error("Error testing webhook:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to test webhook" },
      { status: 500 }
    )
  }
}
