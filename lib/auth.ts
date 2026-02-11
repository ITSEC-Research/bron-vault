import { NextRequest, NextResponse } from 'next/server'

// SECURITY: JWT_SECRET must be set via environment variable — no fallback
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is required. Set it in .env or environment.')
  }
  return secret
}

// User roles type definition
export type UserRole = 'admin' | 'analyst'

export interface JWTPayload {
  userId: string
  username: string
  email?: string  // User email for audit logging
  role?: UserRole  // Optional for backwards compatibility with old tokens
  iat?: number
  exp?: number
}

// =====================================================
// Role-based access control helpers
// =====================================================

/**
 * Get user's role from JWT payload
 * SECURITY: Tokens without role field default to 'analyst' (lowest privilege)
 * This prevents privilege escalation from old/malformed tokens
 */
export function getUserRole(payload: JWTPayload | null): UserRole {
  if (!payload) return 'analyst' // No auth = lowest privilege
  // SECURITY: Default to 'analyst' if role is missing - principle of least privilege
  return payload.role || 'analyst'
}

/**
 * Check if user has admin role
 * SECURITY: Only explicit 'admin' role grants admin access
 */
export function isAdmin(payload: JWTPayload | null): boolean {
  if (!payload) return false
  // SECURITY: Only explicit 'admin' role - no fallback for missing role
  return payload.role === 'admin'
}

/**
 * Check if user has at least analyst role (any authenticated user)
 */
export function isAnalyst(payload: JWTPayload | null): boolean {
  return payload !== null
}

/**
 * Require admin role - returns error response if not admin
 * Use this in API routes that modify data
 */
export function requireAdminRole(payload: JWTPayload | null): NextResponse | null {
  if (!payload) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    )
  }
  
  if (!isAdmin(payload)) {
    return NextResponse.json(
      { success: false, error: "Access denied. Admin role required for this action." },
      { status: 403 }
    )
  }
  
  return null // No error - user is admin
}

// Simple base64 encoding/decoding for Edge Runtime compatibility
function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function base64UrlDecode(str: string): string {
  str += '='.repeat((4 - str.length % 4) % 4)
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'))
}

// Simple HMAC-SHA256 implementation using Web Crypto API
async function hmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(key)
  const messageData = encoder.encode(data)

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await globalThis.crypto.subtle.sign('HMAC', cryptoKey, messageData)
  const signatureArray = new Uint8Array(signature)
  const signatureString = String.fromCharCode(...signatureArray)
  return base64UrlEncode(signatureString)
}

export async function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  }

  const now = Math.floor(Date.now() / 1000)
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + (24 * 60 * 60) // 24 hours
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload))
  const data = `${encodedHeader}.${encodedPayload}`

  const signature = await hmacSha256(getJwtSecret(), data)
  return `${data}.${signature}`
}

// SECURITY: Constant-time string comparison to prevent timing attacks
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const [encodedHeader, encodedPayload, signature] = parts
    const data = `${encodedHeader}.${encodedPayload}`

    // SECURITY: Verify signature using constant-time comparison to prevent timing attacks
    const expectedSignature = await hmacSha256(getJwtSecret(), data)
    if (!constantTimeEqual(signature, expectedSignature)) {
      console.error('JWT signature verification failed')
      return null
    }

    // Decode payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JWTPayload

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.error('JWT token expired')
      return null
    }

    return payload
  } catch (error) {
    console.error('JWT verification failed:', error)
    return null
  }
}

export function getTokenFromRequest(request: NextRequest): string | null {
  // Try to get token from Authorization header first
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // Fallback to cookie
  const authCookie = request.cookies.get('auth')
  return authCookie?.value || null
}

export async function validateRequest(request: NextRequest): Promise<JWTPayload | null> {
  const token = getTokenFromRequest(request)
  if (!token) {
    return null
  }

  return await verifyToken(token)
}

export class AuthError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message)
    this.name = 'AuthError'
  }
}

// =====================================================
// Pending 2FA Token - Secure 2FA flow
// =====================================================

// Separate secret for pending 2FA tokens for additional security
// SECURITY: Derives from JWT_SECRET — no fallback
function getPending2FASecret(): string {
  return getJwtSecret() + '-pending-2fa'
}

interface Pending2FAPayload {
  userId: string
  type: 'pending_2fa'
  iat: number
  exp: number
}

/**
 * Generate a secure pending 2FA token after password verification
 * This token proves the user has passed password authentication
 * and is valid for only 5 minutes to complete 2FA verification
 */
export async function generatePending2FAToken(userId: string): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  }

  const now = Math.floor(Date.now() / 1000)
  const payload: Pending2FAPayload = {
    userId,
    type: 'pending_2fa',
    iat: now,
    exp: now + (5 * 60) // 5 minutes - short-lived for security
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const data = `${encodedHeader}.${encodedPayload}`

  const signature = await hmacSha256(getPending2FASecret(), data)
  return `${data}.${signature}`
}

/**
 * Verify a pending 2FA token
 * Returns userId if valid, null otherwise
 */
export async function verifyPending2FAToken(token: string): Promise<string | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const [encodedHeader, encodedPayload, signature] = parts
    const data = `${encodedHeader}.${encodedPayload}`

    // SECURITY: Verify signature using constant-time comparison
    const expectedSignature = await hmacSha256(getPending2FASecret(), data)
    if (!constantTimeEqual(signature, expectedSignature)) {
      console.error('Pending 2FA token signature verification failed')
      return null
    }

    // Decode and validate payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Pending2FAPayload

    // Verify it's a pending 2FA token
    if (payload.type !== 'pending_2fa') {
      console.error('Invalid token type for pending 2FA')
      return null
    }

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.error('Pending 2FA token expired')
      return null
    }

    return payload.userId
  } catch (error) {
    console.error('Pending 2FA token verification failed:', error)
    return null
  }
}

/**
 * Detect if the request was made over HTTPS (so we can set cookie Secure flag correctly).
 * - Direct HTTPS (no proxy): request URL is https://... → we use that. No proxy or headers needed.
 * - Behind reverse proxy: proxy often forwards as HTTP; we check X-Forwarded-Proto so we still
 *   set Secure when the user actually used HTTPS. If the header is missing, we fall back to
 *   request URL (usually http internally) → secure=false; cookie still works, we just don't set Secure.
 * No env var needed.
 */
export function isRequestSecure(request: NextRequest): boolean {
  const proto = request.headers.get('x-forwarded-proto')
  if (proto === 'https') return true
  try {
    const url = new URL(request.url)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

/** Cookie options for auth cookie; secure flag is derived from the request (HTTPS vs HTTP). */
export function getSecureCookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    secure: isRequestSecure(request),
    sameSite: 'strict' as const,
    maxAge: 24 * 60 * 60, // 24 hours in seconds
    path: '/',
  }
}
