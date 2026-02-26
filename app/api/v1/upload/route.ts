/**
 * Upload API v1 - Stealer Logs Upload
 *
 * POST /api/v1/upload
 * Upload stealer logs ZIP file via API. Always async: returns 202 with jobId and statusUrl.
 * Use GET /api/v1/upload/status/{jobId} to check progress.
 *
 * ADMIN ONLY: Only API keys with 'admin' role can upload.
 */

import { NextRequest, NextResponse } from "next/server"
import { createWriteStream } from "fs"
import { existsSync } from "fs"
import path from "path"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import { mkdir } from "fs/promises"
import { withApiKeyAuth, addRateLimitHeaders, logApiRequest } from "@/lib/api-key-auth"
import { createUploadJob, startUploadJob, completeUploadJob, failUploadJob, addUploadJobLog, updateUploadJob } from "@/lib/upload-job-manager"
import { processFileUploadFromPath } from "@/lib/upload/file-upload-processor"
import { createImportLog, updateImportLog, logUploadAction } from "@/lib/audit-log"
import { executeQuery } from "@/lib/mysql"
import { settingsManager } from "@/lib/settings"
import { formatBytes } from "@/lib/utils"
import pLimit, { type LimitFunction } from "p-limit"
import { v4 as uuidv4 } from "uuid"

export const dynamic = "force-dynamic"
// Static value; setting upload_api_max_duration_seconds in UI is for display/consistency only
export const maxDuration = 300

let uploadLimitInstance: LimitFunction | null = null

async function getUploadLimit(): Promise<LimitFunction> {
  if (uploadLimitInstance) return uploadLimitInstance
  const { apiConcurrency } = await settingsManager.getUploadSettings()
  uploadLimitInstance = pLimit(apiConcurrency)
  return uploadLimitInstance
}

/**
 * Save uploaded File to a temporary path in uploads dir.
 * Caller must ensure cleanup of the returned path when done (e.g. in processUploadFromPathWithJob).
 */
async function saveUploadToTempPath(file: File): Promise<{ tempFilePath: string; originalName: string }> {
  const uploadsDir = path.join(process.cwd(), "uploads")
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true })
  }
  const safeBaseName = path.basename(file.name)
  const tempFileName = `${uuidv4()}_${safeBaseName}`
  const tempFilePath = path.join(uploadsDir, tempFileName)
  const webStream = file.stream()
  const nodeStream = Readable.fromWeb(webStream as any)
  const writeStream = createWriteStream(tempFilePath)
  try {
    await pipeline(nodeStream, writeStream)
  } catch (err) {
    const { unlink } = await import("fs/promises")
    await unlink(tempFilePath).catch(() => {})
    throw err
  }
  return { tempFilePath, originalName: file.name }
}

/**
 * Process upload from a temp file path (used with p-limit for concurrency control).
 * Cleans up temp file when done (success or failure).
 */
async function processUploadFromPathWithJob(
  jobId: string,
  tempFilePath: string,
  originalFileName: string,
  _fileSize: number,
  _apiKeyId: string,
): Promise<void> {
  try {
    await startUploadJob(jobId)
    await addUploadJobLog(jobId, "info", "Processing started (from queue)")

    await updateImportLog(jobId, {
      status: "processing",
      started_at: new Date(),
    })

    let lastProgress = 0
    const logWithJobUpdate = async (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
      console.log(`[Job ${jobId}] ${message}`)
      await addUploadJobLog(jobId, type === "success" ? "info" : type, message)
      const progressMatch = message.match(/\[PROGRESS\]\s*(\d+)\/(\d+)/)
      if (progressMatch) {
        const current = parseInt(progressMatch[1], 10)
        const total = parseInt(progressMatch[2], 10)
        if (total > 0) {
          const progressPercent = Math.min(99, Math.floor((current / total) * 100))
          if (progressPercent > lastProgress) {
            lastProgress = progressPercent
            await updateUploadJob(jobId, {
              progress: progressPercent,
              processedDevices: current,
              totalDevices: total,
            })
            // Also update import log for real-time progress in import-logs page
            await updateImportLog(jobId, {
              processed_devices: current,
              total_devices: total,
            }).catch(err => console.error('Failed to update import log progress:', err))
          }
        }
      }
    }

    const result = await processFileUploadFromPath(
      tempFilePath,
      originalFileName,
      jobId,
      logWithJobUpdate,
      true, // deleteAfterProcessing: processor will delete file when done
    )

    if (result.success) {
      const details = result.details || {}
      const totalDevices = details.devicesFound ?? details.devicesProcessed ?? 0
      const totalCredentials = details.totalCredentials ?? 0
      const totalFiles = details.totalFiles ?? 0

      await completeUploadJob(jobId, { totalDevices, totalCredentials, totalFiles })
      await updateImportLog(jobId, {
        status: "completed",
        total_devices: totalDevices,
        processed_devices: totalDevices,
        total_credentials: totalCredentials,
        total_files: totalFiles,
        completed_at: new Date(),
      })

      const jobInfo = (await executeQuery("SELECT user_id FROM upload_jobs WHERE job_id = ?", [jobId])) as any[]
      if (jobInfo.length > 0) {
        const userResult = (await executeQuery("SELECT email FROM users WHERE id = ?", [jobInfo[0].user_id])) as any[]
        const userEmail = userResult.length > 0 ? userResult[0].email : null
        await logUploadAction(
          "upload.api.complete",
          { id: jobInfo[0].user_id, email: userEmail },
          jobId,
          { total_devices: totalDevices, total_credentials: totalCredentials, total_files: totalFiles },
        )
      }
      await addUploadJobLog(jobId, "info", "Processing completed successfully", result.details)
    } else {
      await failUploadJob(jobId, result.error ?? "Unknown error", "PROCESSING_FAILED")
      await updateImportLog(jobId, {
        status: "failed",
        error_message: result.error ?? "Unknown error",
        completed_at: new Date(),
      })
      const jobInfo = (await executeQuery("SELECT user_id FROM upload_jobs WHERE job_id = ?", [jobId])) as any[]
      if (jobInfo.length > 0) {
        const userResult = (await executeQuery("SELECT email FROM users WHERE id = ?", [jobInfo[0].user_id])) as any[]
        const userEmail = userResult.length > 0 ? userResult[0].email : null
        await logUploadAction(
          "upload.api.fail",
          { id: jobInfo[0].user_id, email: userEmail },
          jobId,
          { error: result.error ?? "Unknown error" },
        )
      }
      await addUploadJobLog(jobId, "error", "Processing failed", { error: result.error })
    }
  } catch (error) {
    console.error(`Background processing error for job ${jobId}:`, error)
    await failUploadJob(jobId, error instanceof Error ? error.message : "Unknown error", "UNEXPECTED_ERROR")
    await updateImportLog(jobId, {
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
      completed_at: new Date(),
    })
    await addUploadJobLog(jobId, "error", "Unexpected error during processing", {
      error: error instanceof Error ? error.message : "Unknown error",
    })
  } finally {
    const { unlink } = await import("fs/promises")
    try {
      if (existsSync(tempFilePath)) {
        await unlink(tempFilePath)
      }
    } catch (_) {
      // Ignore cleanup errors
    }
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  // Validate API key - require ADMIN role for uploads
  const auth = await withApiKeyAuth(request, { requiredRole: 'admin' })
  if (auth.response) {
    return auth.response
  }
  
  const { payload } = auth
  
  let jobId: string | null = null
  let userEmail: string | null = null

  try {
    // Get form data
    const formData = await request.formData()
    const file = formData.get("file") as File
    
    if (!file) {
      return NextResponse.json(
        { 
          success: false, 
          error: "No file uploaded", 
          code: "MISSING_FILE" 
        },
        { status: 400 }
      )
    }

    // Validate file type
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.zip')) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Only ZIP files are supported", 
          code: "INVALID_FILE_TYPE" 
        },
        { status: 400 }
      )
    }

    // Validate file size from settings (same as GUI)
    const { maxFileSize } = await settingsManager.getUploadSettings()
    if (file.size > maxFileSize) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large. Maximum size is ${formatBytes(maxFileSize)}`,
          code: "FILE_TOO_LARGE",
          maxSize: maxFileSize,
          actualSize: file.size,
        },
        { status: 400 }
      )
    }

    // Create upload job
    const { jobId: newJobId } = await createUploadJob({
      apiKeyId: Number(payload.keyId),
      userId: Number(payload.userId),
      originalFilename: file.name,
      fileSize: file.size
    })
    jobId = newJobId

    addUploadJobLog(jobId, 'info', 'Upload job created', { filename: file.name, size: file.size })

    // Get user email for logging
    const userResult = await executeQuery("SELECT email FROM users WHERE id = ?", [payload.userId]) as any[]
    userEmail = userResult.length > 0 ? userResult[0].email : null

    // Create import log entry
    await createImportLog({
      job_id: jobId,
      user_id: Number(payload.userId),
      user_email: userEmail,
      api_key_id: Number(payload.keyId),
      source: 'api',
      filename: file.name,
      file_size: file.size,
      status: 'pending',
      total_devices: 0,
      processed_devices: 0,
      total_credentials: 0,
      total_files: 0,
      error_message: null,
      started_at: null,
      completed_at: null
    })

    // Log the upload start in audit log
    await logUploadAction(
      "upload.api.start",
      { id: Number(payload.userId), email: userEmail },
      jobId,
      { filename: file.name, file_size: file.size, api_key_id: payload.keyId },
      request
    )

    // API upload = async-only. Save file to disk, then process in background under p-limit.
    let tempFilePath: string
    let originalName: string
    try {
      const saved = await saveUploadToTempPath(file)
      tempFilePath = saved.tempFilePath
      originalName = saved.originalName
    } catch (saveError) {
      await failUploadJob(jobId, saveError instanceof Error ? saveError.message : "Failed to save file", "SAVE_ERROR")
      await updateImportLog(jobId, {
        status: "failed",
        error_message: saveError instanceof Error ? saveError.message : "Failed to save file",
        completed_at: new Date(),
      })
      return NextResponse.json(
        {
          success: false,
          error: "Failed to save upload",
          code: "SAVE_ERROR",
          details: String(saveError),
        },
        { status: 500 }
      )
    }

    const uploadLimit = await getUploadLimit()
    void uploadLimit(() =>
      processUploadFromPathWithJob(jobId!, tempFilePath, originalName, file.size, payload.keyId),
    )

    const response = NextResponse.json({
      success: true,
      message: "Upload accepted. Processing started in background.",
      data: {
        jobId: jobId,
        status: "pending",
        statusUrl: `/api/v1/upload/status/${jobId}`,
        filename: file.name,
        fileSize: file.size,
      },
    })
    addRateLimitHeaders(response, payload)
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: "/api/v1/upload",
      method: "POST",
      statusCode: 202,
      requestSize: file.size,
      duration: Date.now() - startTime,
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    })
    return response
  } catch (error) {
    console.error("Upload API error:", error)
    
    // Update job with failure if we have a job ID
    if (jobId) {
      await failUploadJob(jobId, error instanceof Error ? error.message : 'Unknown error', 'UNEXPECTED_ERROR')
      
      // Update import log with error
      await updateImportLog(jobId, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date()
      })

      // Log audit for failed upload
      await logUploadAction(
        'upload.api.fail',
        { id: Number(payload.userId), email: userEmail },
        jobId,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      )
    }
    
    // Log API request
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: '/api/v1/upload',
      method: 'POST',
      statusCode: 500,
      duration: Date.now() - startTime,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return NextResponse.json(
      {
        success: false,
        error: "Upload failed",
        code: "UPLOAD_ERROR",
        details: error instanceof Error ? error.message : "Unknown error",
        data: jobId ? { jobId, status: 'failed' } : undefined
      },
      { status: 500 }
    )
  }
}
