import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@/lib/auth"
import { getAlertStats, listMonitors, listWebhooks } from "@/lib/domain-monitor"

export const dynamic = 'force-dynamic'

/**
 * GET /api/monitoring/stats
 * Get monitoring dashboard stats
 */
export async function GET(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [alertStats, monitorsResult, webhooksResult] = await Promise.all([
      getAlertStats(),
      listMonitors({ activeOnly: false, limit: 1 }),
      listWebhooks({ activeOnly: false, limit: 1 }),
    ])

    // Also get active counts
    const [activeMonitors, activeWebhooks] = await Promise.all([
      listMonitors({ activeOnly: true, limit: 1 }),
      listWebhooks({ activeOnly: true, limit: 1 }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        monitors: {
          total: monitorsResult.total,
          active: activeMonitors.total,
        },
        webhooks: {
          total: webhooksResult.total,
          active: activeWebhooks.total,
        },
        alerts: alertStats,
      },
    })
  } catch (error) {
    console.error("Error getting monitoring stats:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to get stats" },
      { status: 500 }
    )
  }
}
