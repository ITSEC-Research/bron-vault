import { NextRequest, NextResponse } from "next/server"
import { validateRequest, requireAdminRole } from "@/lib/auth"
import { settingsManager } from "@/lib/settings"
import {
  startMigration,
  getMigrationProgress,
  getMigrationLogs,
  abortMigration,
} from "@/lib/storage/migration"
import type { S3Config } from "@/lib/storage"

/**
 * GET /api/settings/storage/migrate
 * Get migration status and progress
 */
export async function GET(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const logSince = searchParams.get("logSince")

    const progress = getMigrationProgress()
    const logs = getMigrationLogs(logSince ? parseInt(logSince, 10) : undefined)

    return NextResponse.json({
      success: true,
      progress,
      logs,
      totalLogs: logs.length,
    })
  } catch (error) {
    console.error("Error getting migration status:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to get migration status" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/storage/migrate
 * Start or abort migration
 */
export async function POST(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const roleError = requireAdminRole(user)
  if (roleError) return roleError

  try {
    const body = await request.json()
    const { action } = body // "start" or "abort"

    if (action === "abort") {
      abortMigration()
      return NextResponse.json({
        success: true,
        message: "Migration abort requested",
      })
    }

    if (action === "start") {
      // Get S3 config from settings
      const storageSettings = await settingsManager.getStorageSettings()

      if (!storageSettings.s3Endpoint || !storageSettings.s3Bucket || !storageSettings.s3AccessKey || !storageSettings.s3SecretKey) {
        return NextResponse.json(
          {
            success: false,
            error: "S3 configuration is incomplete. Please configure S3 settings first and test the connection.",
          },
          { status: 400 }
        )
      }

      const s3Config: S3Config = {
        endpoint: storageSettings.s3Endpoint,
        region: storageSettings.s3Region,
        bucket: storageSettings.s3Bucket,
        accessKey: storageSettings.s3AccessKey,
        secretKey: storageSettings.s3SecretKey,
        pathStyle: storageSettings.s3PathStyle,
        useSSL: storageSettings.s3UseSSL,
      }

      const result = await startMigration(s3Config)

      if (!result.started) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 409 }
        )
      }

      return NextResponse.json({
        success: true,
        message: "Migration started. Poll GET /api/settings/storage/migrate for progress.",
      })
    }

    return NextResponse.json(
      { success: false, error: "Invalid action. Use 'start' or 'abort'." },
      { status: 400 }
    )
  } catch (error) {
    console.error("Error with migration action:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Migration action failed" },
      { status: 500 }
    )
  }
}
