import { NextRequest, NextResponse } from "next/server"
import { validateRequest, requireAdminRole } from "@/lib/auth"
import { createS3Provider, type S3Config } from "@/lib/storage"
import { settingsManager } from "@/lib/settings"

/**
 * POST /api/settings/storage/test
 * Test S3 connection with provided or saved credentials
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

    // Determine if the secret key is masked (loaded from saved settings display)
    const secretKeyIsMasked = !body.s3SecretKey || body.s3SecretKey.startsWith("••••")

    // Always fetch saved settings to resolve masked/missing fields
    const saved = await settingsManager.getStorageSettings()

    const resolvedSecretKey = secretKeyIsMasked ? saved.s3SecretKey : body.s3SecretKey

    const config: S3Config = {
      endpoint: body.s3Endpoint || saved.s3Endpoint,
      region: body.s3Region || saved.s3Region || "us-east-1",
      bucket: body.s3Bucket || saved.s3Bucket,
      accessKey: body.s3AccessKey || saved.s3AccessKey,
      secretKey: resolvedSecretKey,
      pathStyle: body.s3PathStyle !== undefined ? body.s3PathStyle : saved.s3PathStyle,
      useSSL: body.s3UseSSL !== undefined ? body.s3UseSSL : saved.s3UseSSL,
    }

    if (!config.endpoint || !config.bucket || !config.accessKey || !config.secretKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Incomplete S3 configuration. Endpoint, bucket, access key, and secret key are required.",
        },
        { status: 400 }
      )
    }

    // Create temporary provider and test connection
    const provider = createS3Provider(config)
    const result = await provider.testConnection()

    return NextResponse.json({
      success: result.success,
      message: result.message,
      details: result.details,
    })
  } catch (error) {
    console.error("Error testing storage connection:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Connection test failed",
      },
      { status: 500 }
    )
  }
}
