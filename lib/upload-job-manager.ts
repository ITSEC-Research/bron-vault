/**
 * Upload Job Manager
 * 
 * Handles upload job tracking and status updates
 */

import { executeQuery } from './mysql'

export type UploadJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface UploadJob {
  id: number
  jobId: string
  apiKeyId: number
  userId: number
  status: UploadJobStatus
  progress: number
  originalFilename: string | null
  fileSize: number | null
  filePath: string | null
  totalDevices: number
  processedDevices: number
  totalCredentials: number
  totalFiles: number
  errorMessage: string | null
  errorCode: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateUploadJobParams {
  apiKeyId: number
  userId: number
  originalFilename?: string
  fileSize?: number
  filePath?: string
}

export interface UpdateUploadJobParams {
  status?: UploadJobStatus
  progress?: number
  totalDevices?: number
  processedDevices?: number
  totalCredentials?: number
  totalFiles?: number
  errorMessage?: string
  errorCode?: string
  startedAt?: Date
  completedAt?: Date
}

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 10)
  return `job_${timestamp}_${randomPart}`
}

/**
 * Create a new upload job
 */
export async function createUploadJob(params: CreateUploadJobParams): Promise<{ jobId: string; job: UploadJob }> {
  const jobId = generateJobId()
  
  await executeQuery(
    `INSERT INTO upload_jobs (job_id, api_key_id, user_id, original_filename, file_size, file_path)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [jobId, params.apiKeyId, params.userId, params.originalFilename || null, params.fileSize || null, params.filePath || null]
  )
  
  const job = await getUploadJob(jobId)
  if (!job) {
    throw new Error('Failed to create upload job')
  }
  
  return { jobId, job }
}

/**
 * Get upload job by job ID
 */
export async function getUploadJob(jobId: string): Promise<UploadJob | null> {
  const results = await executeQuery(
    `SELECT * FROM upload_jobs WHERE job_id = ?`,
    [jobId]
  ) as any[]
  
  if (!results || results.length === 0) {
    return null
  }
  
  const row = results[0]
  return mapRowToJob(row)
}

/**
 * Get upload job by ID (numeric)
 */
export async function getUploadJobById(id: number): Promise<UploadJob | null> {
  const results = await executeQuery(
    `SELECT * FROM upload_jobs WHERE id = ?`,
    [id]
  ) as any[]
  
  if (!results || results.length === 0) {
    return null
  }
  
  return mapRowToJob(results[0])
}

/**
 * Get upload jobs by user ID
 */
export async function getUploadJobsByUser(userId: number, limit = 50): Promise<UploadJob[]> {
  const results = await executeQuery(
    `SELECT * FROM upload_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  ) as any[]
  
  return results.map(mapRowToJob)
}

/**
 * Get upload jobs by API key ID
 */
export async function getUploadJobsByApiKey(apiKeyId: number, limit = 50): Promise<UploadJob[]> {
  const results = await executeQuery(
    `SELECT * FROM upload_jobs WHERE api_key_id = ? ORDER BY created_at DESC LIMIT ?`,
    [apiKeyId, limit]
  ) as any[]
  
  return results.map(mapRowToJob)
}

/**
 * Update upload job
 */
export async function updateUploadJob(jobId: string, params: UpdateUploadJobParams): Promise<boolean> {
  const updates: string[] = []
  const values: any[] = []
  
  if (params.status !== undefined) {
    updates.push('status = ?')
    values.push(params.status)
  }
  
  if (params.progress !== undefined) {
    updates.push('progress = ?')
    values.push(Math.min(100, Math.max(0, params.progress)))
  }
  
  if (params.totalDevices !== undefined) {
    updates.push('total_devices = ?')
    values.push(params.totalDevices)
  }
  
  if (params.processedDevices !== undefined) {
    updates.push('processed_devices = ?')
    values.push(params.processedDevices)
  }
  
  if (params.totalCredentials !== undefined) {
    updates.push('total_credentials = ?')
    values.push(params.totalCredentials)
  }
  
  if (params.totalFiles !== undefined) {
    updates.push('total_files = ?')
    values.push(params.totalFiles)
  }
  
  if (params.errorMessage !== undefined) {
    updates.push('error_message = ?')
    values.push(params.errorMessage)
  }
  
  if (params.errorCode !== undefined) {
    updates.push('error_code = ?')
    values.push(params.errorCode)
  }
  
  if (params.startedAt !== undefined) {
    updates.push('started_at = ?')
    values.push(params.startedAt)
  }
  
  if (params.completedAt !== undefined) {
    updates.push('completed_at = ?')
    values.push(params.completedAt)
  }
  
  if (updates.length === 0) {
    return true
  }
  
  values.push(jobId)
  
  const result = await executeQuery(
    `UPDATE upload_jobs SET ${updates.join(', ')} WHERE job_id = ?`,
    values
  ) as any
  
  return result.affectedRows > 0
}

/**
 * Add log entry for upload job
 */
export async function addUploadJobLog(
  jobId: string, 
  level: 'debug' | 'info' | 'warning' | 'error',
  message: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await executeQuery(
      `INSERT INTO upload_job_logs (job_id, log_level, message, metadata)
       VALUES (?, ?, ?, ?)`,
      [jobId, level, message, metadata ? JSON.stringify(metadata) : '{}']
    )
  } catch (error) {
    console.error('Failed to add upload job log:', error)
  }
}

/**
 * Get logs for upload job
 */
export async function getUploadJobLogs(jobId: string, limit = 100): Promise<Array<{
  id: number
  level: string
  message: string
  metadata: Record<string, any> | null
  createdAt: Date
}>> {
  const results = await executeQuery(
    `SELECT * FROM upload_job_logs WHERE job_id = ? ORDER BY created_at ASC LIMIT ?`,
    [jobId, limit]
  ) as any[]
  
  return results.map(row => ({
    id: row.id,
    level: row.log_level,
    message: row.message,
    metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
    createdAt: row.created_at
  }))
}

/**
 * Mark job as started
 */
export async function startUploadJob(jobId: string): Promise<boolean> {
  return updateUploadJob(jobId, {
    status: 'processing',
    progress: 0,
    startedAt: new Date()
  })
}

/**
 * Mark job as completed
 */
export async function completeUploadJob(jobId: string, stats: {
  totalDevices: number
  totalCredentials: number
  totalFiles: number
}): Promise<boolean> {
  return updateUploadJob(jobId, {
    status: 'completed',
    progress: 100,
    completedAt: new Date(),
    ...stats,
    processedDevices: stats.totalDevices
  })
}

/**
 * Mark job as failed
 */
export async function failUploadJob(jobId: string, errorMessage: string, errorCode?: string): Promise<boolean> {
  return updateUploadJob(jobId, {
    status: 'failed',
    errorMessage,
    errorCode,
    completedAt: new Date()
  })
}

/**
 * Cancel upload job
 */
export async function cancelUploadJob(jobId: string): Promise<boolean> {
  return updateUploadJob(jobId, {
    status: 'cancelled',
    completedAt: new Date()
  })
}

/**
 * Map database row to UploadJob interface
 */
function mapRowToJob(row: any): UploadJob {
  return {
    id: row.id,
    jobId: row.job_id,
    apiKeyId: row.api_key_id,
    userId: row.user_id,
    status: row.status,
    progress: row.progress,
    originalFilename: row.original_filename,
    fileSize: row.file_size,
    filePath: row.file_path,
    totalDevices: row.total_devices,
    processedDevices: row.processed_devices,
    totalCredentials: row.total_credentials,
    totalFiles: row.total_files,
    errorMessage: row.error_message,
    errorCode: row.error_code,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}
