import { headers } from 'next/headers'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyPrefix?: string
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
  total: number
}

const memoryStore = new Map<string, { count: number; resetTime: number }>()

export function createRateLimiter(config: RateLimitConfig) {
  const { windowMs, maxRequests, keyPrefix = 'rl' } = config

  return async function rateLimit(identifier: string): Promise<RateLimitResult> {
    const key = `${keyPrefix}:${identifier}`
    const now = Date.now()
    const windowStart = now - windowMs

    const record = memoryStore.get(key)
    
    if (!record || record.resetTime < now) {
      memoryStore.set(key, { count: 1, resetTime: now + windowMs })
      return { success: true, remaining: maxRequests - 1, resetTime: now + windowMs, total: maxRequests }
    }

    if (record.count >= maxRequests) {
      return { success: false, remaining: 0, resetTime: record.resetTime, total: maxRequests }
    }

    record.count++
    return { success: true, remaining: maxRequests - record.count, resetTime: record.resetTime, total: maxRequests }
  }
}

export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  return ip
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': result.total.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
  }
}

// Pre-configured rate limiters for different operations
export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
  keyPrefix: 'api',
})

export const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 AI requests per minute
  keyPrefix: 'ai',
})

export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 20, // 20 uploads per hour
  keyPrefix: 'upload',
})

export const ragRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 RAG queries per minute
  keyPrefix: 'rag',
})

export const voiceRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20, // 20 voice requests per minute
  keyPrefix: 'voice',
})

// Cleanup old entries periodically
if (typeof window === 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of memoryStore.entries()) {
      if (record.resetTime < now) {
        memoryStore.delete(key)
      }
    }
  }, 5 * 60 * 1000) // Every 5 minutes
}