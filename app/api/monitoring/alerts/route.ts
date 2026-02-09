import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@/lib/auth"
import { listAlerts } from "@/lib/domain-monitor"

export const dynamic = 'force-dynamic'

/**
 * GET /api/monitoring/alerts
 * List alert history
 */
export async function GET(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const monitorId = searchParams.get("monitor_id") ? parseInt(searchParams.get("monitor_id")!) : undefined
    const webhookId = searchParams.get("webhook_id") ? parseInt(searchParams.get("webhook_id")!) : undefined
    const status = searchParams.get("status") as 'success' | 'failed' | 'retrying' | undefined
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    const result = await listAlerts({ monitorId, webhookId, status, limit, offset })

    return NextResponse.json({
      success: true,
      data: result.alerts,
      total: result.total,
    })
  } catch (error) {
    console.error("Error listing alerts:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to list alerts" },
      { status: 500 }
    )
  }
}
