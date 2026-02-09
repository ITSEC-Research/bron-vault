/**
 * Upload API v1 - Stealer Logs Upload
 * 
 * POST /api/v1/upload
 * Upload stealer logs ZIP file via API
 * 
 * ADMIN ONLY: Only API keys with 'admin' role can upload
 * 
 * Default behavior: ASYNC (returns immediately with job ID)
 * - Response includes job ID and status URL for tracking
 * - Use GET /api/v1/upload/status/{jobId} to check progress
 * 
 * Optional: ?sync=true for synchronous processing (waits for completion)
 * - Not recommended for large files (>100MB)
 * - May timeout for very large uploads
 */

import { NextRequest, NextResponse } from "next/server"
import { withApiKeyAuth, addRateLimitHeaders, logApiRequest } from "@/lib/api-key-auth"
import { createUploadJob, startUploadJob, completeUploadJob, failUploadJob, addUploadJobLog, updateUploadJob } from "@/lib/upload-job-manager"
import { processFileUpload } from "@/lib/upload/file-upload-processor"
import { createImportLog, updateImportLog, logUploadAction } from "@/lib/audit-log"
import { executeQuery } from "@/lib/mysql"

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for upload processing

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

    // Validate file size (max 10GB for async processing)
    // Note: For very large files, consider using chunked upload endpoint instead
    const maxSize = 10 * 1024 * 1024 * 1024 // 10GB
    if (file.size > maxSize) {
      return NextResponse.json(
        { 
          success: false, 
          error: "File too large. Maximum size is 10GB", 
          code: "FILE_TOO_LARGE",
          maxSize: maxSize,
          actualSize: file.size
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
      'upload.api.start',
      { id: Number(payload.userId), email: userEmail },
      jobId,
      { filename: file.name, file_size: file.size, api_key_id: payload.keyId },
      request
    )

    // By default, process asynchronously (return immediately)
    // Use ?sync=true to wait for processing to complete (not recommended for large files)
    const processSync = formData.get("sync") === "true"
    
    if (!processSync) {
      // Start processing in background (fire and forget) - DEFAULT BEHAVIOR
      processUploadInBackground(jobId, file, payload.keyId)
      
      const response = NextResponse.json({
        success: true,
        message: "Upload accepted. Processing started in background.",
        data: {
          jobId: jobId,
          status: 'pending',
          statusUrl: `/api/v1/upload/status/${jobId}`,
          filename: file.name,
          fileSize: file.size
        }
      })
      
      addRateLimitHeaders(response, payload)
      
      // Log API request
      logApiRequest({
        apiKeyId: payload.keyId,
        endpoint: '/api/v1/upload',
        method: 'POST',
        statusCode: 202, // Accepted
        requestSize: file.size,
        duration: Date.now() - startTime,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      })
      
      return response
    }

    // Synchronous processing (wait for completion)
    await startUploadJob(jobId)
    addUploadJobLog(jobId, 'info', 'Processing started')

    // Update import log to processing status
    await updateImportLog(jobId, {
      status: 'processing',
      started_at: new Date()
    })

    // Track last progress to avoid too many database updates
    let lastProgressSync = 0

    // Create a logger that updates job logs and progress
    const logWithJobUpdate = async (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
      console.log(`[Job ${jobId}] ${message}`)
      await addUploadJobLog(jobId!, type === 'success' ? 'info' : type, message)
      
      // Parse progress messages: [PROGRESS] X/Y
      const progressMatch = message.match(/\[PROGRESS\]\s*(\d+)\/(\d+)/)
      if (progressMatch) {
        const current = parseInt(progressMatch[1], 10)
        const total = parseInt(progressMatch[2], 10)
        if (total > 0) {
          // Calculate progress percentage (0-99, reserve 100 for completion)
          const progressPercent = Math.min(99, Math.floor((current / total) * 100))
          
          // Only update if progress changed by at least 1%
          if (progressPercent > lastProgressSync) {
            lastProgressSync = progressPercent
            await updateUploadJob(jobId!, { 
              progress: progressPercent,
              processedDevices: current,
              totalDevices: total
            })
          }
        }
      }
    }

    // Process the file
    const result = await processFileUpload(file, jobId, logWithJobUpdate)

    if (result.success) {
      // Extract stats from result.details
      // The zip processors return: devicesFound, devicesProcessed, totalCredentials, totalFiles
      const details = result.details || {}
      const totalDevices = details.devicesFound || details.devicesProcessed || 0
      const totalCredentials = details.totalCredentials || 0
      const totalFiles = details.totalFiles || 0
      
      // Update job with success
      await completeUploadJob(jobId, {
        totalDevices,
        totalCredentials,
        totalFiles
      })

      // Update import log with results
      await updateImportLog(jobId, {
        status: 'completed',
        total_devices: totalDevices,
        processed_devices: totalDevices,
        total_credentials: totalCredentials,
        total_files: totalFiles,
        completed_at: new Date()
      })

      // Log audit for successful upload
      await logUploadAction(
        'upload.api.complete',
        { id: Number(payload.userId), email: userEmail },
        jobId,
        { total_devices: totalDevices, total_credentials: totalCredentials, total_files: totalFiles }
      )

      const response = NextResponse.json({
        success: true,
        message: "Upload processed successfully",
        data: {
          jobId: jobId,
          status: 'completed',
          stats: {
            totalDevices,
            totalCredentials,
            totalFiles,
            processingTime: Date.now() - startTime
          }
        }
      })

      addRateLimitHeaders(response, payload)

      // Log API request
      logApiRequest({
        apiKeyId: payload.keyId,
        endpoint: '/api/v1/upload',
        method: 'POST',
        statusCode: 200,
        requestSize: file.size,
        duration: Date.now() - startTime,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined
      })

      return response
    } else {
      // Update job with failure
      await failUploadJob(jobId, result.error || 'Unknown error', 'PROCESSING_FAILED')

      // Update import log with error
      await updateImportLog(jobId, {
        status: 'failed',
        error_message: result.error || 'Unknown error',
        completed_at: new Date()
      })

      // Log audit for failed upload
      await logUploadAction(
        'upload.api.fail',
        { id: Number(payload.userId), email: userEmail },
        jobId,
        { error: result.error || 'Unknown error' }
      )

      return NextResponse.json(
        {
          success: false,
          error: "Upload processing failed",
          code: "PROCESSING_FAILED",
          details: result.error,
          data: {
            jobId: jobId,
            status: 'failed'
          }
        },
        { status: 500 }
      )
    }
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

/**
 * Process upload in background (for async mode)
 */
async function processUploadInBackground(jobId: string, file: File, _apiKeyId: string): Promise<void> {
  try {
    await startUploadJob(jobId)
    await addUploadJobLog(jobId, 'info', 'Background processing started')

    // Update import log to processing status
    await updateImportLog(jobId, {
      status: 'processing',
      started_at: new Date()
    })

    // Track last progress to avoid too many database updates
    let lastProgress = 0

    const logWithJobUpdate = async (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
      console.log(`[Job ${jobId}] ${message}`)
      await addUploadJobLog(jobId, type === 'success' ? 'info' : type, message)
      
      // Parse progress messages: [PROGRESS] X/Y
      const progressMatch = message.match(/\[PROGRESS\]\s*(\d+)\/(\d+)/)
      if (progressMatch) {
        const current = parseInt(progressMatch[1], 10)
        const total = parseInt(progressMatch[2], 10)
        if (total > 0) {
          // Calculate progress percentage (0-99, reserve 100 for completion)
          const progressPercent = Math.min(99, Math.floor((current / total) * 100))
          
          // Only update if progress changed by at least 1%
          if (progressPercent > lastProgress) {
            lastProgress = progressPercent
            await updateUploadJob(jobId, { 
              progress: progressPercent,
              processedDevices: current,
              totalDevices: total
            })
          }
        }
      }
    }

    const result = await processFileUpload(file, jobId, logWithJobUpdate)

    if (result.success) {
      // Extract stats from result.details
      // The zip processors return: devicesFound, devicesProcessed, totalCredentials, totalFiles
      const details = result.details || {}
      const totalDevices = details.devicesFound || details.devicesProcessed || 0
      const totalCredentials = details.totalCredentials || 0
      const totalFiles = details.totalFiles || 0

      await completeUploadJob(jobId, {
        totalDevices,
        totalCredentials,
        totalFiles
      })

      // Update import log with results
      await updateImportLog(jobId, {
        status: 'completed',
        total_devices: totalDevices,
        processed_devices: totalDevices,
        total_credentials: totalCredentials,
        total_files: totalFiles,
        completed_at: new Date()
      })

      // Get user info for audit log
      const jobInfo = await executeQuery(
        "SELECT user_id FROM upload_jobs WHERE job_id = ?",
        [jobId]
      ) as any[]
      
      if (jobInfo.length > 0) {
        const userResult = await executeQuery("SELECT email FROM users WHERE id = ?", [jobInfo[0].user_id]) as any[]
        const userEmail = userResult.length > 0 ? userResult[0].email : null
        
        await logUploadAction(
          'upload.api.complete',
          { id: jobInfo[0].user_id, email: userEmail },
          jobId,
          { total_devices: totalDevices, total_credentials: totalCredentials, total_files: totalFiles }
        )
      }

      await addUploadJobLog(jobId, 'info', 'Processing completed successfully', result.details)
    } else {
      await failUploadJob(jobId, result.error || 'Unknown error', 'PROCESSING_FAILED')
      
      // Update import log with error
      await updateImportLog(jobId, {
        status: 'failed',
        error_message: result.error || 'Unknown error',
        completed_at: new Date()
      })

      // Get user info for audit log
      const jobInfo = await executeQuery(
        "SELECT user_id FROM upload_jobs WHERE job_id = ?",
        [jobId]
      ) as any[]
      
      if (jobInfo.length > 0) {
        const userResult = await executeQuery("SELECT email FROM users WHERE id = ?", [jobInfo[0].user_id]) as any[]
        const userEmail = userResult.length > 0 ? userResult[0].email : null
        
        await logUploadAction(
          'upload.api.fail',
          { id: jobInfo[0].user_id, email: userEmail },
          jobId,
          { error: result.error || 'Unknown error' }
        )
      }

      await addUploadJobLog(jobId, 'error', 'Processing failed', { error: result.error })
    }
  } catch (error) {
    console.error(`Background processing error for job ${jobId}:`, error)
    await failUploadJob(jobId, error instanceof Error ? error.message : 'Unknown error', 'UNEXPECTED_ERROR')
    
    // Update import log with error
    await updateImportLog(jobId, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      completed_at: new Date()
    })

    await addUploadJobLog(jobId, 'error', 'Unexpected error during processing', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
}
