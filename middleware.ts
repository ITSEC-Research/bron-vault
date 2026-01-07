import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@/lib/auth"

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/verify-totp",
  "/api/auth/check-users",
  "/api/auth/register-first-user",
  "/_next",
  "/favicon.ico"
]

// SECURITY: Rate limiting for auth endpoints to prevent brute force attacks
// Simple in-memory rate limiter for middleware (Edge-compatible)
const authRateLimitMap = new Map<string, { count: number; resetTime: number }>()

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  return forwarded?.split(',')[0]?.trim() || realIp || 'anonymous'
}

function checkAuthRateLimit(request: NextRequest): { allowed: boolean; remaining: number } {
  const clientIP = getClientIP(request)
  const now = Date.now()
  const windowMs = 15 * 60 * 1000 // 15 minutes
  const maxAttempts = 10 // Max 10 login/TOTP attempts per 15 minutes
  
  // Cleanup expired entries periodically
  if (authRateLimitMap.size > 10000) {
    for (const [key, value] of authRateLimitMap.entries()) {
      if (now > value.resetTime) {
        authRateLimitMap.delete(key)
      }
    }
  }
  
  const current = authRateLimitMap.get(clientIP)
  
  if (!current || now > current.resetTime) {
    authRateLimitMap.set(clientIP, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxAttempts - 1 }
  }
  
  if (current.count >= maxAttempts) {
    return { allowed: false, remaining: 0 }
  }
  
  current.count++
  return { allowed: true, remaining: maxAttempts - current.count }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // SECURITY: Rate limit auth endpoints to prevent brute force attacks
  if (pathname === '/api/auth/login' || pathname === '/api/auth/verify-totp') {
    const rateLimit = checkAuthRateLimit(request)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many login attempts. Please try again in 15 minutes." },
        { 
          status: 429,
          headers: {
            'Retry-After': '900', // 15 minutes in seconds
            'X-RateLimit-Remaining': '0'
          }
        }
      )
    }
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next()
  }

  // Allow static files
  if (pathname.match(/\.(png|svg|jpg|jpeg|ico|css|js)$/)) {
    return NextResponse.next()
  }

  // Validate JWT token
  const user = await validateRequest(request)
  if (!user) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Add user info to headers for API routes
  const response = NextResponse.next()
  response.headers.set("x-user-id", user.userId)
  response.headers.set("x-username", user.username)
  // SECURITY: Include role in headers for API routes to check authorization
  if (user.role) {
    response.headers.set("x-user-role", user.role)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};