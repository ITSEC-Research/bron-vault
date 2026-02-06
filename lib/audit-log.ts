/**
 * Audit Logging System
 * 
 * Provides centralized audit logging functionality for tracking
 * all important user actions in the application.
 */

import { pool } from "@/lib/mysql"
import type { ResultSetHeader } from "mysql2"

// Audit log action categories
export type AuditAction =
  // Upload actions
  | 'upload.start'
  | 'upload.complete'
  | 'upload.fail'
  | 'upload.api.start'
  | 'upload.api.complete'
  | 'upload.api.fail'
  // User management actions
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'user.login'
  | 'user.logout'
  | 'user.login.fail'
  | 'user.password.change'
  | 'user.totp.enable'
  | 'user.totp.disable'
  // API Key management actions
  | 'apikey.create'
  | 'apikey.update'
  | 'apikey.delete'
  | 'apikey.revoke'
  // Settings actions
  | 'settings.update'
  // Device/Data actions
  | 'device.delete'
  | 'data.export'

// Audit log entry interface
export interface AuditLogEntry {
  id?: number
  user_id: number | null
  user_email: string | null
  action: AuditAction
  resource_type: string
  resource_id: string | null
  details: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at?: Date
}

// Import log status
export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

// Import log source
export type ImportSource = 'web' | 'api'

// Import log entry interface
export interface ImportLogEntry {
  id?: number
  job_id: string
  user_id: number | null
  user_email: string | null
  api_key_id: number | null
  source: ImportSource
  filename: string | null
  file_size: number | null
  status: ImportStatus
  total_devices: number
  processed_devices: number
  total_credentials: number
  total_files: number
  error_message: string | null
  started_at: Date | null
  completed_at: Date | null
  created_at?: Date
  updated_at?: Date
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<number> {
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO audit_logs (user_id, user_email, action, resource_type, resource_id, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.user_id,
        entry.user_email,
        entry.action,
        entry.resource_type,
        entry.resource_id,
        JSON.stringify(entry.details || {}),
        entry.ip_address,
        entry.user_agent
      ]
    )
    return result.insertId
  } catch (error) {
    console.error('Failed to create audit log:', error)
    // Don't throw - audit logging should not break the main flow
    return -1
  }
}

/**
 * Helper to extract client info from request
 */
export function getClientInfo(request: Request): { ip: string | null; userAgent: string | null } {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip')
  const userAgent = request.headers.get('user-agent')
  
  return {
    ip: ip || null,
    userAgent: userAgent?.substring(0, 500) || null
  }
}

/**
 * Create or update an import log entry
 */
export async function createImportLog(entry: Omit<ImportLogEntry, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO import_logs (job_id, user_id, user_email, api_key_id, source, filename, file_size, status, total_devices, processed_devices, total_credentials, total_files, error_message, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.job_id,
        entry.user_id,
        entry.user_email,
        entry.api_key_id,
        entry.source,
        entry.filename,
        entry.file_size,
        entry.status,
        entry.total_devices,
        entry.processed_devices,
        entry.total_credentials,
        entry.total_files,
        entry.error_message,
        entry.started_at,
        entry.completed_at
      ]
    )
    return result.insertId
  } catch (error) {
    console.error('Failed to create import log:', error)
    return -1
  }
}

/**
 * Update an import log entry
 */
export async function updateImportLog(
  jobId: string, 
  updates: Partial<Omit<ImportLogEntry, 'id' | 'job_id' | 'created_at'>>
): Promise<boolean> {
  try {
    const setClauses: string[] = []
    const values: unknown[] = []
    
    if (updates.status !== undefined) {
      setClauses.push('status = ?')
      values.push(updates.status)
    }
    if (updates.total_devices !== undefined) {
      setClauses.push('total_devices = ?')
      values.push(updates.total_devices)
    }
    if (updates.processed_devices !== undefined) {
      setClauses.push('processed_devices = ?')
      values.push(updates.processed_devices)
    }
    if (updates.total_credentials !== undefined) {
      setClauses.push('total_credentials = ?')
      values.push(updates.total_credentials)
    }
    if (updates.total_files !== undefined) {
      setClauses.push('total_files = ?')
      values.push(updates.total_files)
    }
    if (updates.error_message !== undefined) {
      setClauses.push('error_message = ?')
      values.push(updates.error_message)
    }
    if (updates.started_at !== undefined) {
      setClauses.push('started_at = ?')
      values.push(updates.started_at)
    }
    if (updates.completed_at !== undefined) {
      setClauses.push('completed_at = ?')
      values.push(updates.completed_at)
    }
    
    if (setClauses.length === 0) return true
    
    values.push(jobId)
    await pool.query(
      `UPDATE import_logs SET ${setClauses.join(', ')} WHERE job_id = ?`,
      values
    )
    return true
  } catch (error) {
    console.error('Failed to update import log:', error)
    return false
  }
}

/**
 * Log user CRUD operations
 */
export async function logUserAction(
  action: 'user.create' | 'user.update' | 'user.delete' | 'user.login' | 'user.logout' | 'user.login.fail' | 'user.password.change' | 'user.totp.enable' | 'user.totp.disable',
  performedBy: { id: number | null; email: string | null },
  targetUserId: number | string | null,
  details: Record<string, unknown>,
  request?: Request
): Promise<number> {
  const clientInfo = request ? getClientInfo(request) : { ip: null, userAgent: null }
  
  return createAuditLog({
    user_id: performedBy.id,
    user_email: performedBy.email,
    action,
    resource_type: 'user',
    resource_id: targetUserId ? String(targetUserId) : null,
    details,
    ip_address: clientInfo.ip,
    user_agent: clientInfo.userAgent
  })
}

/**
 * Log API key CRUD operations
 */
export async function logApiKeyAction(
  action: 'apikey.create' | 'apikey.update' | 'apikey.delete' | 'apikey.revoke',
  performedBy: { id: number | null; email: string | null },
  apiKeyId: number | string | null,
  details: Record<string, unknown>,
  request?: Request
): Promise<number> {
  const clientInfo = request ? getClientInfo(request) : { ip: null, userAgent: null }
  
  return createAuditLog({
    user_id: performedBy.id,
    user_email: performedBy.email,
    action,
    resource_type: 'api_key',
    resource_id: apiKeyId ? String(apiKeyId) : null,
    details,
    ip_address: clientInfo.ip,
    user_agent: clientInfo.userAgent
  })
}

/**
 * Log settings changes
 */
export async function logSettingsAction(
  performedBy: { id: number | null; email: string | null },
  settingKey: string,
  details: Record<string, unknown>,
  request?: Request
): Promise<number> {
  const clientInfo = request ? getClientInfo(request) : { ip: null, userAgent: null }
  
  return createAuditLog({
    user_id: performedBy.id,
    user_email: performedBy.email,
    action: 'settings.update',
    resource_type: 'settings',
    resource_id: settingKey,
    details,
    ip_address: clientInfo.ip,
    user_agent: clientInfo.userAgent
  })
}

/**
 * Log upload operations
 */
export async function logUploadAction(
  action: 'upload.start' | 'upload.complete' | 'upload.fail' | 'upload.api.start' | 'upload.api.complete' | 'upload.api.fail',
  performedBy: { id: number | null; email: string | null },
  jobId: string | null,
  details: Record<string, unknown>,
  request?: Request
): Promise<number> {
  const clientInfo = request ? getClientInfo(request) : { ip: null, userAgent: null }
  
  return createAuditLog({
    user_id: performedBy.id,
    user_email: performedBy.email,
    action,
    resource_type: 'upload',
    resource_id: jobId,
    details,
    ip_address: clientInfo.ip,
    user_agent: clientInfo.userAgent
  })
}

/**
 * Log device deletion
 */
export async function logDeviceAction(
  action: 'device.delete',
  performedBy: { id: number | null; email: string | null },
  deviceId: string,
  details: Record<string, unknown>,
  request?: Request
): Promise<number> {
  const clientInfo = request ? getClientInfo(request) : { ip: null, userAgent: null }
  
  return createAuditLog({
    user_id: performedBy.id,
    user_email: performedBy.email,
    action,
    resource_type: 'device',
    resource_id: deviceId,
    details,
    ip_address: clientInfo.ip,
    user_agent: clientInfo.userAgent
  })
}

/**
 * Log data export
 */
export async function logDataExport(
  performedBy: { id: number | null; email: string | null },
  exportType: string,
  details: Record<string, unknown>,
  request?: Request
): Promise<number> {
  const clientInfo = request ? getClientInfo(request) : { ip: null, userAgent: null }
  
  return createAuditLog({
    user_id: performedBy.id,
    user_email: performedBy.email,
    action: 'data.export',
    resource_type: exportType,
    resource_id: null,
    details,
    ip_address: clientInfo.ip,
    user_agent: clientInfo.userAgent
  })
}
