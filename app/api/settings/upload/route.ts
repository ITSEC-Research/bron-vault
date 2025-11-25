import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@/lib/auth"
import { settingsManager } from "@/lib/settings"

/**
 * GET /api/settings/upload
 * Get upload-specific settings (convenience endpoint)
 */
export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const uploadSettings = await settingsManager.getUploadSettings()

    return NextResponse.json({
      success: true,
      ...uploadSettings,
    })
  } catch (error) {
    console.error("Error getting upload settings:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get upload settings",
      },
      { status: 500 }
    )
  }
}

