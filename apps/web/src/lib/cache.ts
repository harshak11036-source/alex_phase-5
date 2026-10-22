import { createHash } from 'crypto'

interface CacheEntry<T> {
  data: T
  timestamp: number
  hits: number
}

interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  maxSize?: number // Maximum number of entries
}

class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private ttl: number
  private maxSize: number

  constructor(options: CacheOptions = {}) {
    this.ttl = options.ttl || 5 * 60 * 1000 // 5 minutes default
    this.maxSize = options.maxSize || 1000
  }

  private generateKey(key: string): string {
    return createHash('sha256').update(key).digest('hex').slice(0, 32)
  }

  get(key: string): T | null {
    const hashedKey = this.generateKey(key)
    const entry = this.cache.get(hashedKey)
    
    if (!entry) return null
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(hashedKey)
      return null
    }
    
    entry.hits++
    return entry.data
  }

  set(key: string, data: T): void {
    const hashedKey = this.generateKey(key)
    
    // Evict oldest if at max size
    if (this.cache.size >= this.maxSize) {
      let oldestKey = ''
      let oldestTime = Date.now()
      
      for (const [k, v] of this.cache.entries()) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp
          oldestKey = k
        }
      }
      
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }
    
    this.cache.set(hashedKey, {
      data,
      timestamp: Date.now(),
      hits: 0,
    })
  }

  delete(key: string): boolean {
    const hashedKey = this.generateKey(key)
    return this.cache.delete(hashedKey)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  // Get stats for monitoring
  getStats() {
    let totalHits = 0
    for (const entry of this.cache.values()) {
      totalHits += entry.hits
    }
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalHits,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0,
    }
  }
}

// Global cache instances
export const ragQueryCache = new MemoryCache<{ answer: string; citations: any[]; sources: any[] }>({
  ttl: 10 * 60 * 1000, // 10 minutes
  maxSize: 500,
})

export const embeddingCache = new MemoryCache<number[][]>({
  ttl: 60 * 60 * 1000, // 1 hour
  maxSize: 1000,
})

export const documentContentCache = new MemoryCache<string>({
  ttl: 30 * 60 * 1000, // 30 minutes
  maxSize: 200,
})

// Request deduplication for concurrent identical requests
const pendingRequests = new Map<string, Promise<any>>()

export async function deduplicateRequest<T>(
  key: string,
  factory: () => Promise<T>
): Promise<T> {
  const existing = pendingRequests.get(key)
  if (existing) {
    return existing as Promise<T>
  }

  const promise = factory().finally(() => {
    pendingRequests.delete(key)
  })

  pendingRequests.set(key, promise)
  return promise
}

// Generate cache key from request parameters
export function generateCacheKey(...parts: (string | number | boolean | object)[]): string {
  return parts.map(p => 
    typeof p === 'object' ? JSON.stringify(p) : String(p)
  ).join('|')
}

// Batch multiple operations
export async function batchOperations<T, R>(
  items: T[],
  operation: (batch: T[]) => Promise<R[]>,
  batchSize: number = 10
): Promise<R[]> {
  const results: R[] = []
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await operation(batch)
    results.push(...batchResults)
  }
  
  return results
}

// Retry with exponential backoff
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt === maxRetries) {
        throw lastError
      }
      
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError!
}

// Circuit breaker for external services
interface CircuitBreakerState {
  failures: number
  lastFailure: number
  state: 'closed' | 'open' | 'half-open'
}

const circuitBreakers = new Map<string, CircuitBreakerState>()

export function createCircuitBreaker(
  serviceName: string,
  failureThreshold: number = 5,
  resetTimeout: number = 60000
) {
  return async function<T>(operation: () => Promise<T>): Promise<T> {
    const state = circuitBreakers.get(serviceName) || {
      failures: 0,
      lastFailure: 0,
      state: 'closed' as const,
    }
    
    if (state.state === 'open') {
      if (Date.now() - state.lastFailure > resetTimeout) {
        state.state = 'half-open'
      } else {
        throw new Error(`Circuit breaker open for ${serviceName}`)
      }
    }
    
    try {
      const result = await operation()
      
      if (state.state === 'half-open') {
        state.state = 'closed'
        state.failures = 0
      }
      
      return result
    } catch (error) {
      state.failures++
      state.lastFailure = Date.now()
      
      if (state.failures >= failureThreshold) {
        state.state = 'open'
      }
      
      circuitBreakers.set(serviceName, state)
      throw error
    }
  }
}