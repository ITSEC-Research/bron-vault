import { type NextRequest, NextResponse } from "next/server"
import { validateRequest, requireAdminRole } from "@/lib/auth"
import { broadcastLogToSession, closeLogSession } from "@/lib/upload-connections"
import { processFileUpload } from "./file-upload-processor"
import { createImportLog, updateImportLog, logUploadAction } from "@/lib/audit-log"
import { v4 as uuidv4 } from "uuid"

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

  // Generate a unique job ID for this import
  const jobId = `web-${uuidv4().substring(0, 8)}`

  try {
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    // Create import log entry
    await createImportLog({
      job_id: jobId,
      user_id: Number(user.userId),
      user_email: user.email || null,
      api_key_id: null,
      source: 'web',
      filename: file.name,
      file_size: file.size,
      status: 'processing',
      total_devices: 0,
      processed_devices: 0,
      total_credentials: 0,
      total_files: 0,
      error_message: null,
      started_at: new Date(),
      completed_at: null
    })

    // Log the upload start in audit log
    await logUploadAction(
      'upload.start',
      { id: Number(user.userId), email: user.email || null },
      jobId,
      { filename: file.name, file_size: file.size },
      request
    )

    // Process file upload
    const result = await processFileUpload(file, sessionId, logWithBroadcast)

    // Close log session
    setTimeout(() => closeLogSession(sessionId), 1000)

    if (result.success) {
      // Update import log with results
      await updateImportLog(jobId, {
        status: 'completed',
        total_devices: result.details?.totalDevices || 0,
        processed_devices: result.details?.totalDevices || 0,
        total_credentials: result.details?.totalCredentials || 0,
        total_files: result.details?.totalFiles || 0,
        completed_at: new Date()
      })

      // Log the upload completion in audit log
      await logUploadAction(
        'upload.complete',
        { id: Number(user.userId), email: user.email || null },
        jobId,
        { 
          total_devices: result.details?.totalDevices || 0,
          total_credentials: result.details?.totalCredentials || 0,
          total_files: result.details?.totalFiles || 0
        },
        request
      )

      return NextResponse.json({
        success: true,
        details: result.details,
      })
    } else {
      // Update import log with error
      await updateImportLog(jobId, {
        status: 'failed',
        error_message: result.error || 'Unknown error',
        completed_at: new Date()
      })

      // Log the upload failure in audit log
      await logUploadAction(
        'upload.fail',
        { id: Number(user.userId), email: user.email || null },
        jobId,
        { error: result.error || 'Unknown error' },
        request
      )

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

    // Update import log with error
    await updateImportLog(jobId, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      completed_at: new Date()
    })

    // Log the upload failure in audit log
    await logUploadAction(
      'upload.fail',
      { id: Number(user.userId), email: user.email || null },
      jobId,
      { error: error instanceof Error ? error.message : 'Unknown error' },
      request
    )

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

