/**
 * Monitoring Stats API v1
 * 
 * GET /api/v1/monitoring/stats   - Get monitoring dashboard stats
 */

import { NextRequest, NextResponse } from "next/server"
import { withApiKeyAuth, addRateLimitHeaders, logApiRequest } from "@/lib/api-key-auth"
import { getAlertStats, listMonitors, listWebhooks } from "@/lib/domain-monitor"

export const dynamic = 'force-dynamic'

/**
 * GET /api/v1/monitoring/stats
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  const auth = await withApiKeyAuth(request)
  if (auth.response) return auth.response
  const { payload } = auth

  try {
    const [alertStats, monitorsResult, webhooksResult] = await Promise.all([
      getAlertStats(),
      listMonitors({ activeOnly: false, limit: 1 }),
      listWebhooks({ activeOnly: false, limit: 1 }),
    ])

    const [activeMonitors, activeWebhooks] = await Promise.all([
      listMonitors({ activeOnly: true, limit: 1 }),
      listWebhooks({ activeOnly: true, limit: 1 }),
    ])

    const response = NextResponse.json({
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
      meta: { checkedAt: new Date().toISOString() }
    })

    addRateLimitHeaders(response, payload)
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: '/api/v1/monitoring/stats',
      method: 'GET',
      statusCode: 200,
      duration: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return response
  } catch (error) {
    console.error("v1 monitoring stats error:", error)
    const duration = Date.now() - startTime
    logApiRequest({ apiKeyId: payload.keyId, endpoint: '/api/v1/monitoring/stats', method: 'GET', statusCode: 500, duration })
    return NextResponse.json(
      { success: false, error: "Failed to get monitoring stats", code: "INTERNAL_ERROR", details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    )
  }
}
