import { NextRequest, NextResponse } from "next/server"
import { validateRequest, requireAdminRole } from "@/lib/auth"
import { settingsManager } from "@/lib/settings"

/**
 * GET /api/settings
 * Get all settings or settings by prefix
 * Note: Both admin and analyst can READ settings
 */
export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const prefix = searchParams.get("prefix")

    let settings
    if (prefix) {
      settings = await settingsManager.getSettingsByPrefix(prefix)
    } else {
      settings = await settingsManager.getAllSettings()
    }

    return NextResponse.json({
      success: true,
      settings,
    })
  } catch (error) {
    console.error("Error getting settings:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get settings",
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings
 * Update setting(s)
 * Note: Only admin can UPDATE settings
 */
export async function POST(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  // Check admin role - analysts cannot modify settings
  const roleError = requireAdminRole(user)
  if (roleError) {
    return roleError
  }

  try {
    const body = await request.json()

    // Support both single and multiple updates
    if (body.key_name && body.value !== undefined) {
      // Single update
      await settingsManager.updateSetting(body.key_name, body.value)
      return NextResponse.json({
        success: true,
        message: "Setting updated successfully",
        updated: 1,
      })
    } else if (Array.isArray(body.settings)) {
      // Multiple updates
      let updated = 0
      for (const setting of body.settings) {
        if (setting.key_name && setting.value !== undefined) {
          await settingsManager.updateSetting(setting.key_name, setting.value)
          updated++
        }
      }
      return NextResponse.json({
        success: true,
        message: `${updated} setting(s) updated successfully`,
        updated,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request format. Expected { key_name, value } or { settings: [...] }",
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("Error updating settings:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update settings",
      },
      { status: 500 }
    )
  }
}

