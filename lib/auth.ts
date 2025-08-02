import { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'

export interface JWTPayload {
  userId: string
  username: string
  iat?: number
  exp?: number
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

  const signature = await hmacSha256(JWT_SECRET, data)
  return `${data}.${signature}`
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const [encodedHeader, encodedPayload, signature] = parts
    const data = `${encodedHeader}.${encodedPayload}`

    // Verify signature
    const expectedSignature = await hmacSha256(JWT_SECRET, data)
    if (signature !== expectedSignature) {
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

// Helper function to create secure cookie options
export function getSecureCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 24 * 60 * 60, // 24 hours in seconds
    path: '/',
  }
}
