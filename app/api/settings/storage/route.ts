import { NextRequest, NextResponse } from "next/server"
import { validateRequest, requireAdminRole } from "@/lib/auth"
import { settingsManager } from "@/lib/settings"
import { resetStorageProvider } from "@/lib/storage"
import { logSettingsAction } from "@/lib/audit-log"

/**
 * GET /api/settings/storage
 * Get storage configuration
 */
export async function GET(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const storageSettings = await settingsManager.getStorageSettings()

    // Mask the secret key for security
    const maskedSettings = {
      ...storageSettings,
      s3SecretKey: storageSettings.s3SecretKey
        ? "••••••••" + storageSettings.s3SecretKey.slice(-4)
        : "",
    }

    return NextResponse.json({
      success: true,
      ...maskedSettings,
    })
  } catch (error) {
    console.error("Error getting storage settings:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to get storage settings" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/storage
 * Update storage configuration
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
    const {
      storageType,
      s3Endpoint,
      s3Region,
      s3Bucket,
      s3AccessKey,
      s3SecretKey,
      s3PathStyle,
      s3UseSSL,
    } = body

    // Validate storage type
    if (storageType && !["local", "s3"].includes(storageType)) {
      return NextResponse.json(
        { success: false, error: "Invalid storage type. Must be 'local' or 's3'" },
        { status: 400 }
      )
    }

    // If switching to S3, validate required fields
    if (storageType === "s3") {
      if (!s3Endpoint || !s3Bucket || !s3AccessKey) {
        return NextResponse.json(
          { success: false, error: "S3 endpoint, bucket, and access key are required" },
          { status: 400 }
        )
      }
    }

    // Save settings
    const updates: Array<{ key: string; value: string }> = []

    if (storageType !== undefined) {
      updates.push({ key: "storage_type", value: storageType })
    }
    if (s3Endpoint !== undefined) {
      updates.push({ key: "storage_s3_endpoint", value: s3Endpoint })
    }
    if (s3Region !== undefined) {
      updates.push({ key: "storage_s3_region", value: s3Region || "us-east-1" })
    }
    if (s3Bucket !== undefined) {
      updates.push({ key: "storage_s3_bucket", value: s3Bucket })
    }
    if (s3AccessKey !== undefined) {
      updates.push({ key: "storage_s3_access_key", value: s3AccessKey })
    }
    // Only update secret key if it's not masked
    if (s3SecretKey !== undefined && !s3SecretKey.startsWith("••••")) {
      updates.push({ key: "storage_s3_secret_key", value: s3SecretKey })
    }
    if (s3PathStyle !== undefined) {
      updates.push({ key: "storage_s3_path_style", value: String(s3PathStyle) })
    }
    if (s3UseSSL !== undefined) {
      updates.push({ key: "storage_s3_use_ssl", value: String(s3UseSSL) })
    }

    for (const update of updates) {
      await settingsManager.updateSetting(update.key, update.value)
    }

    // Reset the cached storage provider so next access picks up new settings
    resetStorageProvider()

    // Audit log
    await logSettingsAction(
      { id: Number(user.userId), email: user.email || null },
      "storage_configuration",
      { updated_keys: updates.map((u) => u.key) },
      request
    )

    return NextResponse.json({
      success: true,
      message: "Storage settings saved successfully",
      updated: updates.length,
    })
  } catch (error) {
    console.error("Error saving storage settings:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save storage settings" },
      { status: 500 }
    )
  }
}
