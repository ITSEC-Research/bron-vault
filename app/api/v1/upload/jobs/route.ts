/**
 * Upload Jobs List API v1
 * 
 * GET /api/v1/upload/jobs
 * List upload jobs for the current user
 * 
 * Admin can see all jobs, others can only see their own
 */

import { NextRequest, NextResponse } from "next/server"
import { withApiKeyAuth, addRateLimitHeaders, logApiRequest } from "@/lib/api-key-auth"
import { executeQuery } from "@/lib/mysql"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  // Validate API key
  const auth = await withApiKeyAuth(request)
  if (auth.response) {
    return auth.response
  }
  
  const { payload } = auth

  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))
    const status = searchParams.get('status') // Filter by status

    let query = ''
    const params: any[] = []

    if (payload.role === 'admin') {
      // Admin can see all jobs
      query = `
        SELECT uj.*, u.name as user_name, u.email as user_email, ak.name as api_key_name
        FROM upload_jobs uj
        JOIN users u ON uj.user_id = u.id
        JOIN api_keys ak ON uj.api_key_id = ak.id
      `
      if (status) {
        query += ' WHERE uj.status = ?'
        params.push(status)
      }
      // SECURITY: Use parameterized LIMIT (CRIT-10)
      query += ` ORDER BY uj.created_at DESC LIMIT ?`
      params.push(limit)
    } else {
      // Others can only see their own jobs
      query = `
        SELECT uj.*, ak.name as api_key_name
        FROM upload_jobs uj
        JOIN api_keys ak ON uj.api_key_id = ak.id
        WHERE uj.user_id = ?
      `
      params.push(Number(payload.userId))
      
      if (status) {
        query += ' AND uj.status = ?'
        params.push(status)
      }
      // SECURITY: Use parameterized LIMIT (CRIT-10)
      query += ` ORDER BY uj.created_at DESC LIMIT ?`
      params.push(limit)
    }

    const results = await executeQuery(query, params) as any[]

    const jobs = results.map(row => ({
      jobId: row.job_id,
      status: row.status,
      progress: row.progress,
      filename: row.original_filename,
      fileSize: row.file_size,
      stats: {
        totalDevices: row.total_devices,
        processedDevices: row.processed_devices,
        totalCredentials: row.total_credentials,
        totalFiles: row.total_files
      },
      error: row.status === 'failed' ? {
        message: row.error_message,
        code: row.error_code
      } : null,
      apiKeyName: row.api_key_name,
      timing: {
        createdAt: row.created_at,
        startedAt: row.started_at,
        completedAt: row.completed_at
      },
      // Only include user info for admin
      ...(payload.role === 'admin' && {
        userId: row.user_id,
        userName: row.user_name,
        userEmail: row.user_email
      })
    }))

    const response = NextResponse.json({
      success: true,
      data: {
        jobs,
        pagination: {
          limit,
          count: jobs.length
        }
      }
    })

    addRateLimitHeaders(response, payload)

    const duration = Date.now() - startTime
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: '/api/v1/upload/jobs',
      method: 'GET',
      statusCode: 200,
      duration,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return response
  } catch (error) {
    console.error("Upload jobs list error:", error)

    const duration = Date.now() - startTime
    logApiRequest({
      apiKeyId: payload.keyId,
      endpoint: '/api/v1/upload/jobs',
      method: 'GET',
      statusCode: 500,
      duration,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined
    })

    return NextResponse.json(
      {
        success: false,
        error: "Failed to list upload jobs",
        code: "LIST_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
