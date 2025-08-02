import { NextRequest, NextResponse } from 'next/server'

interface RateLimitConfig {
  requests: number
  window: number // in milliseconds
}

interface RequestLog {
  count: number
  resetTime: number
}

class RateLimiter {
  private requests = new Map<string, RequestLog>()
  
  // Default configs for different endpoints
  private configs: Record<string, RateLimitConfig> = {
    '/api/search': { requests: 30, window: 60000 }, // 30 requests per minute
    '/api/stats': { requests: 10, window: 60000 },   // 10 requests per minute
    '/api/upload': { requests: 5, window: 300000 },  // 5 uploads per 5 minutes
    '/api/auth': { requests: 5, window: 300000 },    // 5 auth attempts per 5 minutes
    'default': { requests: 20, window: 60000 }       // Default: 20 requests per minute
  }

  private getClientId(request: NextRequest): string {
    // Try to get real IP from headers (for production behind proxy)
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ip = forwarded?.split(',')[0] || realIp || request.ip || 'anonymous'
    
    // Include user agent for additional uniqueness
    const userAgent = request.headers.get('user-agent') || 'unknown'
    return `${ip}:${userAgent.slice(0, 50)}`
  }

  private getConfig(pathname: string): RateLimitConfig {
    // Find matching config or use default
    for (const [path, config] of Object.entries(this.configs)) {
      if (pathname.startsWith(path)) {
        return config
      }
    }
    return this.configs.default
  }

  private cleanupExpired() {
    const now = Date.now()
    for (const [key, log] of this.requests.entries()) {
      if (now > log.resetTime) {
        this.requests.delete(key)
      }
    }
  }

  public check(request: NextRequest): { allowed: boolean; limit: number; remaining: number; resetTime: number } {
    this.cleanupExpired()
    
    const clientId = this.getClientId(request)
    const config = this.getConfig(request.nextUrl.pathname)
    const now = Date.now()
    
    const existing = this.requests.get(clientId)
    
    if (!existing || now > existing.resetTime) {
      // First request or window expired
      const resetTime = now + config.window
      this.requests.set(clientId, { count: 1, resetTime })
      
      return {
        allowed: true,
        limit: config.requests,
        remaining: config.requests - 1,
        resetTime
      }
    }
    
    if (existing.count >= config.requests) {
      // Rate limit exceeded
      return {
        allowed: false,
        limit: config.requests,
        remaining: 0,
        resetTime: existing.resetTime
      }
    }
    
    // Increment count
    existing.count++
    this.requests.set(clientId, existing)
    
    return {
      allowed: true,
      limit: config.requests,
      remaining: config.requests - existing.count,
      resetTime: existing.resetTime
    }
  }

  public createResponse(result: ReturnType<typeof this.check>): NextResponse | null {
    if (result.allowed) {
      return null // No response needed, continue
    }
    
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000)
    
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again in ${retryAfter} seconds.`,
        retryAfter
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetTime.toString(),
          'Retry-After': retryAfter.toString()
        }
      }
    )
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter()

// Middleware helper
export function withRateLimit(handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const result = rateLimiter.check(request)
    
    if (!result.allowed) {
      return rateLimiter.createResponse(result)!
    }
    
    const response = await handler(request)
    
    // Add rate limit headers to successful responses
    response.headers.set('X-RateLimit-Limit', result.limit.toString())
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
    response.headers.set('X-RateLimit-Reset', result.resetTime.toString())
    
    return response
  }
}
