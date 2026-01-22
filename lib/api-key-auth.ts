/**
 * API Key Authentication Module
 * 
 * Provides API key generation, validation, and management for external API access.
 * Supports role-based access control (admin vs analyst).
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from './mysql'

// API Key prefix for identification
const API_KEY_PREFIX = 'bv_'
const API_KEY_LENGTH = 32 // Length of the random part

export type ApiKeyRole = 'admin' | 'analyst'

export interface ApiKeyPayload {
  keyId: string
  userId: string
  userName: string
  role: ApiKeyRole
  name: string
  rateLimit: number
  rateLimitWindow: number // in seconds
}

export interface ApiKeyRecord {
  id: number
  user_id: number
  key_prefix: string
  key_hash: string
  name: string
  role: ApiKeyRole
  rate_limit: number
  rate_limit_window: number
  is_active: boolean
  expires_at: Date | null
  last_used_at: Date | null
  created_at: Date
  updated_at: Date
  // Joined fields
  user_name?: string
  user_email?: string
}

// In-memory rate limiting store (for simple implementation)
// In production, use Redis for distributed rate limiting
const rateLimitStore = new Map<string, { count: number; windowStart: number }>()

/**
 * Generate a cryptographically secure random string
 */
function generateSecureRandom(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const array = new Uint8Array(length)
  globalThis.crypto.getRandomValues(array)
  return Array.from(array, (byte) => chars[byte % chars.length]).join('')
}

/**
 * Hash API key using SHA-256
 */
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(apiKey)
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data)
  const hashArray = new Uint8Array(hashBuffer)
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Generate a new API key
 * Returns the full API key (only shown once) and the hash for storage
 */
export async function generateApiKey(): Promise<{ apiKey: string; keyPrefix: string; keyHash: string }> {
  const randomPart = generateSecureRandom(API_KEY_LENGTH)
  const apiKey = `${API_KEY_PREFIX}${randomPart}`
  const keyPrefix = apiKey.substring(0, 10) // First 10 chars for identification
  const keyHash = await hashApiKey(apiKey)
  
  return { apiKey, keyPrefix, keyHash }
}

/**
 * Create a new API key in the database
 */
export async function createApiKey(params: {
  userId: number
  name: string
  role: ApiKeyRole
  rateLimit?: number
  rateLimitWindow?: number
  expiresAt?: Date | null
}): Promise<{ apiKey: string; record: ApiKeyRecord }> {
  const { apiKey, keyPrefix, keyHash } = await generateApiKey()
  
  const rateLimit = params.rateLimit || 100 // 100 requests per window
  const rateLimitWindow = params.rateLimitWindow || 60 // 60 seconds
  
  const result = await executeQuery(
    `INSERT INTO api_keys (user_id, key_prefix, key_hash, name, role, rate_limit, rate_limit_window, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [params.userId, keyPrefix, keyHash, params.name, params.role, rateLimit, rateLimitWindow, params.expiresAt || null]
  ) as any
  
  // Get the created record
  const records = await executeQuery(
    `SELECT ak.*, u.name as user_name, u.email as user_email
     FROM api_keys ak
     JOIN users u ON ak.user_id = u.id
     WHERE ak.id = ?`,
    [result.insertId]
  ) as any[]
  const record = records[0]
  
  return { apiKey, record: record as unknown as ApiKeyRecord }
}

/**
 * Validate API key from request
 * Returns the API key payload if valid, null otherwise
 */
export async function validateApiKey(request: NextRequest): Promise<ApiKeyPayload | null> {
  // Get API key from header
  const apiKey = request.headers.get('X-API-Key') || 
                 request.headers.get('Authorization')?.replace('Bearer ', '')
  
  if (!apiKey) {
    return null
  }
  
  // Validate format
  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    return null
  }
  
  // Hash the key for lookup
  const keyHash = await hashApiKey(apiKey)
  
  // Look up in database
  const results = await executeQuery(
    `SELECT ak.*, u.name as user_name, u.email as user_email
     FROM api_keys ak
     JOIN users u ON ak.user_id = u.id
     WHERE ak.key_hash = ? 
       AND ak.is_active = 1 
       AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
    [keyHash]
  ) as any[]
  
  if (!results || results.length === 0) {
    return null
  }
  
  const keyRecord = results[0] as unknown as ApiKeyRecord
  
  // Update last used timestamp (async, don't wait)
  executeQuery(
    'UPDATE api_keys SET last_used_at = NOW() WHERE id = ?',
    [keyRecord.id]
  ).catch(err => console.error('Failed to update last_used_at:', err))
  
  return {
    keyId: String(keyRecord.id),
    userId: String(keyRecord.user_id),
    userName: keyRecord.user_name || '',
    role: keyRecord.role,
    name: keyRecord.name,
    rateLimit: keyRecord.rate_limit,
    rateLimitWindow: keyRecord.rate_limit_window,
  }
}

/**
 * Check rate limit for API key
 * Returns true if within limit, false if exceeded
 */
export function checkRateLimit(apiKeyPayload: ApiKeyPayload): { allowed: boolean; remaining: number; resetAt: number } {
  const key = `ratelimit:${apiKeyPayload.keyId}`
  const now = Math.floor(Date.now() / 1000)
  
  const existing = rateLimitStore.get(key)
  
  if (!existing || now - existing.windowStart >= apiKeyPayload.rateLimitWindow) {
    // New window
    rateLimitStore.set(key, { count: 1, windowStart: now })
    return { 
      allowed: true, 
      remaining: apiKeyPayload.rateLimit - 1,
      resetAt: now + apiKeyPayload.rateLimitWindow
    }
  }
  
  if (existing.count >= apiKeyPayload.rateLimit) {
    // Rate limit exceeded
    return { 
      allowed: false, 
      remaining: 0,
      resetAt: existing.windowStart + apiKeyPayload.rateLimitWindow
    }
  }
  
  // Increment count
  existing.count++
  return { 
    allowed: true, 
    remaining: apiKeyPayload.rateLimit - existing.count,
    resetAt: existing.windowStart + apiKeyPayload.rateLimitWindow
  }
}

/**
 * Middleware helper for API routes
 * Validates API key and checks rate limit
 */
export async function withApiKeyAuth(
  request: NextRequest,
  options?: {
    requiredRole?: ApiKeyRole
  }
): Promise<{ payload: ApiKeyPayload; response: null } | { payload: null; response: NextResponse }> {
  const payload = await validateApiKey(request)
  
  if (!payload) {
    return {
      payload: null,
      response: NextResponse.json(
        { 
          success: false, 
          error: 'Invalid or missing API key',
          code: 'INVALID_API_KEY'
        },
        { status: 401 }
      )
    }
  }
  
  // Check role if required
  if (options?.requiredRole === 'admin' && payload.role !== 'admin') {
    return {
      payload: null,
      response: NextResponse.json(
        { 
          success: false, 
          error: 'Admin API key required for this endpoint',
          code: 'INSUFFICIENT_PERMISSIONS'
        },
        { status: 403 }
      )
    }
  }
  
  // Check rate limit
  const rateLimit = checkRateLimit(payload)
  
  if (!rateLimit.allowed) {
    return {
      payload: null,
      response: NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimit.resetAt - Math.floor(Date.now() / 1000)
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(payload.rateLimit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimit.resetAt),
            'Retry-After': String(rateLimit.resetAt - Math.floor(Date.now() / 1000))
          }
        }
      )
    }
  }
  
  return { payload, response: null }
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(response: NextResponse, payload: ApiKeyPayload): NextResponse {
  const rateLimit = checkRateLimit(payload)
  response.headers.set('X-RateLimit-Limit', String(payload.rateLimit))
  response.headers.set('X-RateLimit-Remaining', String(Math.max(0, rateLimit.remaining)))
  response.headers.set('X-RateLimit-Reset', String(rateLimit.resetAt))
  return response
}

/**
 * Get all API keys for a user
 */
export async function getApiKeysByUser(userId: number): Promise<Omit<ApiKeyRecord, 'key_hash'>[]> {
  const results = await executeQuery(
    `SELECT id, user_id, key_prefix, name, role, rate_limit, rate_limit_window, 
            is_active, expires_at, last_used_at, created_at, updated_at
     FROM api_keys
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId]
  ) as any[]
  
  return results as unknown as Omit<ApiKeyRecord, 'key_hash'>[]
}

/**
 * Get all API keys (admin only)
 */
export async function getAllApiKeys(): Promise<Omit<ApiKeyRecord, 'key_hash'>[]> {
  const results = await executeQuery(
    `SELECT ak.id, ak.user_id, ak.key_prefix, ak.name, ak.role, ak.rate_limit, 
            ak.rate_limit_window, ak.is_active, ak.expires_at, ak.last_used_at, 
            ak.created_at, ak.updated_at, u.name as user_name, u.email as user_email
     FROM api_keys ak
     JOIN users u ON ak.user_id = u.id
     ORDER BY ak.created_at DESC`
  ) as any[]
  
  return results as unknown as Omit<ApiKeyRecord, 'key_hash'>[]
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId: number, userId?: number): Promise<boolean> {
  let query = 'UPDATE api_keys SET is_active = 0 WHERE id = ?'
  const params: any[] = [keyId]
  
  // If userId provided, ensure user owns the key
  if (userId) {
    query += ' AND user_id = ?'
    params.push(userId)
  }
  
  const result = await executeQuery(query, params) as any
  return result.affectedRows > 0
}

/**
 * Delete an API key
 */
export async function deleteApiKey(keyId: number, userId?: number): Promise<boolean> {
  let query = 'DELETE FROM api_keys WHERE id = ?'
  const params: any[] = [keyId]
  
  // If userId provided, ensure user owns the key
  if (userId) {
    query += ' AND user_id = ?'
    params.push(userId)
  }
  
  const result = await executeQuery(query, params) as any
  return result.affectedRows > 0
}

/**
 * Log API request for audit
 */
export async function logApiRequest(params: {
  apiKeyId: string
  endpoint: string
  method: string
  statusCode: number
  requestSize?: number
  responseSize?: number
  duration?: number
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  try {
    await executeQuery(
      `INSERT INTO api_request_logs 
       (api_key_id, endpoint, method, status_code, request_size, response_size, duration_ms, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.apiKeyId,
        params.endpoint,
        params.method,
        params.statusCode,
        params.requestSize || null,
        params.responseSize || null,
        params.duration || null,
        params.ipAddress || null,
        params.userAgent || null
      ]
    )
  } catch (error) {
    console.error('Failed to log API request:', error)
  }
}
