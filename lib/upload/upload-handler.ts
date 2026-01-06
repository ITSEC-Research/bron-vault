import { type NextRequest, NextResponse } from "next/server"
import { validateRequest, requireAdminRole } from "@/lib/auth"
import { broadcastLogToSession, closeLogSession } from "@/lib/upload-connections"
import { processFileUpload } from "./file-upload-processor"

export async function handleUploadRequest(request: NextRequest): Promise<NextResponse> {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  // Check admin role - analysts cannot upload data
  const roleError = requireAdminRole(user)
  if (roleError) {
    return roleError
  }

  const formData = await request.formData()
  const sessionId = (formData.get("sessionId") as string) || "default"

  // Helper function for logging with broadcast
  const logWithBroadcast = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    console.log(message)
    broadcastLogToSession(sessionId, message, type)
  }

  // Small delay to ensure log stream connection is established
  await new Promise(resolve => setTimeout(resolve, 200))

  logWithBroadcast("🚀 Upload API called", "info")

  try {
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    // Process file upload
    const result = await processFileUpload(file, sessionId, logWithBroadcast)

    // Close log session
    setTimeout(() => closeLogSession(sessionId), 1000)

    if (result.success) {
      return NextResponse.json({
        success: true,
        details: result.details,
      })
    } else {
      return NextResponse.json(
        {
          error: "Processing failed",
          details: result.error || "Unknown error",
        },
        { status: 500 },
      )
    }
  } catch (error) {
    logWithBroadcast("💥 Upload processing error:" + error, "error")

    // Close log session
    setTimeout(() => closeLogSession(sessionId), 1000)

    return NextResponse.json(
      {
        error: "Processing failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

