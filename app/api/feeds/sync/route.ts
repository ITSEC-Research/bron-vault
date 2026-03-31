import { NextRequest, NextResponse } from "next/server"
import { validateRequest, requireAdminRole } from "@/lib/auth"
import { forceSyncAllFeeds } from "@/lib/feed-sync"

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // allow up to 5 minutes to fetch all feeds just in case

export async function POST(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  // Only admins can force a global sync
  const roleError = requireAdminRole(user)
  if (roleError) return roleError

  try {
    console.log(`[NewsFeed] Admin ${user.email} triggered a manual Fetch Now`)
    const stats = await forceSyncAllFeeds()

    if (stats.sourcesProcessed === 0 && stats.sourcesFailed > 0) {
      return NextResponse.json({ 
        success: false, 
        message: "Failed to sync feeds", 
        stats,
        error: stats.errors[0]
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: `Sync complete. Processing ${stats.sourcesProcessed} sources, added ${stats.articlesAdded} articles.`,
      stats 
    })
  } catch (error) {
    console.error("[NewsFeed] Manual sync error:", error)
    return NextResponse.json({ success: false, error: "Failed to trigger sync" }, { status: 500 })
  }
}
