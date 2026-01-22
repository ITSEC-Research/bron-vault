/**
 * Upload API v1 - Stealer Logs Upload
 * 
 * POST /api/v1/upload
 * Upload stealer logs ZIP file via API
 * 
 * ADMIN ONLY: Only API keys with 'admin' role can upload
 */

import { NextRequest, NextResponse } from "next/server"
import { withApiKeyAuth, addRateLimitHeaders, logApiRequest } from "@/lib/api-key-auth"
import { createUploadJob, startUploadJob, completeUploadJob, failUploadJob, addUploadJobLog } from "@/lib/upload-job-manager"
import { processFileUpload } from "@/lib/upload/file-upload-processor"

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

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024 // 500MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { 
          success: false, 
          error: "File too large. Maximum size is 500MB", 
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

    // Return job ID immediately for async processing
    // The actual processing will update the job status
    const returnImmediately = formData.get("async") === "true"
    
    if (returnImmediately) {
      // Start processing in background (fire and forget)
      processUploadInBackground(jobId, file, payload.keyId)
      
      const response = NextResponse.json({
        success: true,
        message: "Upload accepted. Processing started in background.",
        data: {
          jobId: jobId,
          status: 'pending',
          statusUrl: `/api/v1/upload/status/${jobId}`
        }
      })
      
      addRateLimitHeaders(response, payload)
      return response
    }

    // Synchronous processing (wait for completion)
    await startUploadJob(jobId)
    addUploadJobLog(jobId, 'info', 'Processing started')

    // Create a logger that updates job logs
    const logWithJobUpdate = async (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
      console.log(`[Job ${jobId}] ${message}`)
      await addUploadJobLog(jobId!, type === 'success' ? 'info' : type, message)
    }

    // Process the file
    const result = await processFileUpload(file, jobId, logWithJobUpdate)

    if (result.success) {
      // Update job with success
      await completeUploadJob(jobId, {
        totalDevices: result.details?.deviceCount || 0,
        totalCredentials: result.details?.credentialCount || 0,
        totalFiles: result.details?.fileCount || 0
      })

      const response = NextResponse.json({
        success: true,
        message: "Upload processed successfully",
        data: {
          jobId: jobId,
          status: 'completed',
          stats: {
            totalDevices: result.details?.deviceCount || 0,
            totalCredentials: result.details?.credentialCount || 0,
            totalFiles: result.details?.fileCount || 0,
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

    const logWithJobUpdate = async (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
      console.log(`[Job ${jobId}] ${message}`)
      await addUploadJobLog(jobId, type === 'success' ? 'info' : type, message)
    }

    const result = await processFileUpload(file, jobId, logWithJobUpdate)

    if (result.success) {
      await completeUploadJob(jobId, {
        totalDevices: result.details?.deviceCount || 0,
        totalCredentials: result.details?.credentialCount || 0,
        totalFiles: result.details?.fileCount || 0
      })
      await addUploadJobLog(jobId, 'info', 'Processing completed successfully', result.details)
    } else {
      await failUploadJob(jobId, result.error || 'Unknown error', 'PROCESSING_FAILED')
      await addUploadJobLog(jobId, 'error', 'Processing failed', { error: result.error })
    }
  } catch (error) {
    console.error(`Background processing error for job ${jobId}:`, error)
    await failUploadJob(jobId, error instanceof Error ? error.message : 'Unknown error', 'UNEXPECTED_ERROR')
    await addUploadJobLog(jobId, 'error', 'Unexpected error during processing', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
  }
}
