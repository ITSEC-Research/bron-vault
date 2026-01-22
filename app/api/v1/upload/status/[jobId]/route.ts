/**
 * Upload Status API v1 - Check Upload Progress
 * 
 * GET /api/v1/upload/status/[jobId]
 * Check the status and progress of an upload job
 * 
 * Available for all API key roles (admin & analyst can check status)
 * But only the owner of the job can see details
 */

import { NextRequest, NextResponse } from "next/server"
import { withApiKeyAuth, addRateLimitHeaders, logApiRequest } from "@/lib/api-key-auth"
import { getUploadJob, getUploadJobLogs } from "@/lib/upload-job-manager"

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{
    jobId: string
  }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now()
  
  // Validate API key
  const auth = await withApiKeyAuth(request)
  if (auth.response) {
    return auth.response
  }
  
  const { payload } = auth

  try {
    const { jobId } = await params
    
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: "Job ID is required", code: "MISSING_JOB_ID" },
        { status: 400 }
      )
    }

    // Get the upload job
    const job = await getUploadJob(jobId)
    
    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found", code: "JOB_NOT_FOUND" },
        { status: 404 }
      )
    }

    // Check ownership - only admin can see all jobs, others can only see their own
    if (payload.role !== 'admin' && String(job.userId) !== payload.userId) {
      return NextResponse.json(
        { success: false, error: "Access denied", code: "ACCESS_DENIED" },
        { status: 403 }
      )
    }

    // Get optional query params
    const searchParams = request.nextUrl.searchParams
    const includeLogs = searchParams.get('logs') === 'true'

    // Build response
    const responseData: any = {
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      filename: job.originalFilename,
      fileSize: job.fileSize,
      stats: {
        totalDevices: job.totalDevices,
        processedDevices: job.processedDevices,
        totalCredentials: job.totalCredentials,
        totalFiles: job.totalFiles
      },
      timing: {
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        processingTime: job.completedAt && job.startedAt 
          ? new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()
          : null
      }
    }

    // Include error info if failed
    if (job.status === 'failed') {
      responseData.error = {
        message: job.errorMessage,
        code: job.errorCode
      }
    }

    // Include logs if requested
    if (includeLogs) {
      const logs = await getUploadJobLogs(jobId, 100)
      responseData.logs = logs.map(log => ({
        level: log.level,
        message: log.message,
        timestamp: log.createdAt,
        metadata: log.metadata
      }))
    }

    const response = NextResponse.json({
      success: true,
      data: responseData
    })

    // Add rate limit headers
    addRateLimitHeaders(response, payload)

    // Log API request
    const duration = Date.now() - startTime
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: `/api/v1/upload/status/${jobId}`,
      method: 'GET',
      statusCode: 200,
      duration,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return response
  } catch (error) {
    console.error("Upload status error:", error)
    
    const duration = Date.now() - startTime
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: '/api/v1/upload/status',
      method: 'GET',
      statusCode: 500,
      duration,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return NextResponse.json(
      {
        success: false,
        error: "Failed to get upload status",
        code: "STATUS_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
