import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@/lib/auth"
import { executeQuery } from "@/lib/mysql"

// Define the user preferences interface
export interface UserPreferences {
  stream_enabled?: boolean
  // Add more preferences here as needed
}

// Default preferences
const DEFAULT_PREFERENCES: UserPreferences = {
  stream_enabled: true,
}

interface UserRow {
  preferences: string | null
}

/**
 * GET /api/user/preferences
 * Get current user's preferences
 */
export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const userId = user.userId
    if (!userId) {
      return NextResponse.json({ success: false, error: "User ID not found" }, { status: 400 })
    }

    // Get user preferences from database
    const result = await executeQuery(
      "SELECT preferences FROM users WHERE id = ?",
      [userId]
    ) as UserRow[]

    if (!result || result.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Parse preferences JSON or use defaults
    let preferences: UserPreferences = { ...DEFAULT_PREFERENCES }
    if (result[0].preferences) {
      try {
        const savedPreferences = typeof result[0].preferences === 'string' 
          ? JSON.parse(result[0].preferences) 
          : result[0].preferences
        preferences = { ...DEFAULT_PREFERENCES, ...savedPreferences }
      } catch {
        console.error("Error parsing user preferences, using defaults")
      }
    }

    return NextResponse.json({
      success: true,
      preferences,
    })
  } catch (error) {
    console.error("Error getting user preferences:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get preferences",
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/user/preferences
 * Update current user's preferences
 */
export async function POST(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const userId = user.userId
    if (!userId) {
      return NextResponse.json({ success: false, error: "User ID not found" }, { status: 400 })
    }

    const body = await request.json()
    const newPreferences: Partial<UserPreferences> = body.preferences || body

    // Get current preferences
    const result = await executeQuery(
      "SELECT preferences FROM users WHERE id = ?",
      [userId]
    ) as UserRow[]

    if (!result || result.length === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Merge with existing preferences
    let currentPreferences: UserPreferences = { ...DEFAULT_PREFERENCES }
    if (result[0].preferences) {
      try {
        const savedPreferences = typeof result[0].preferences === 'string' 
          ? JSON.parse(result[0].preferences) 
          : result[0].preferences
        currentPreferences = { ...DEFAULT_PREFERENCES, ...savedPreferences }
      } catch {
        console.error("Error parsing existing preferences, starting fresh")
      }
    }

    const updatedPreferences = { ...currentPreferences, ...newPreferences }

    // Update preferences in database
    await executeQuery(
      "UPDATE users SET preferences = ? WHERE id = ?",
      [JSON.stringify(updatedPreferences), userId]
    )

    return NextResponse.json({
      success: true,
      message: "Preferences updated successfully",
      preferences: updatedPreferences,
    })
  } catch (error) {
    console.error("Error updating user preferences:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update preferences",
      },
      { status: 500 }
    )
  }
}
