import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@/lib/auth"
import { settingsManager } from "@/lib/settings"

/**
 * GET /api/settings/batch
 * Get batch size settings (convenience endpoint)
 */
export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const batchSettings = await settingsManager.getBatchSettings()

    return NextResponse.json({
      success: true,
      ...batchSettings,
    })
  } catch (error) {
    console.error("Error getting batch settings:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get batch settings",
      },
      { status: 500 }
    )
  }
}

