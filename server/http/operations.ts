import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'

export interface ApiLogger {
  info(event: Record<string, unknown>): void
}

export interface RateLimitOptions {
  windowMs: number
  maxRequests: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

export const defaultApiLogger: ApiLogger = {
  info(event) {
    console.info(JSON.stringify(event))
  },
}

export function apiOperations(
  logger: ApiLogger = defaultApiLogger,
): RequestHandler {
  return (request, response, next) => {
    const requestId = request.header('x-request-id')?.trim()
    const safeRequestId = requestId && /^[a-zA-Z0-9_-]{8,128}$/.test(requestId)
      ? requestId
      : randomUUID()
    response.setHeader('X-Request-Id', safeRequestId)
    response.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'")
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('X-Frame-Options', 'DENY')
    response.setHeader('Referrer-Policy', 'no-referrer')

    const startedAt = Date.now()
    const requestPath = request.path
    response.on('finish', () => {
      logger.info({
        event: 'http_request', requestId: safeRequestId, method: request.method,
        path: requestPath, status: response.statusCode, durationMs: Date.now() - startedAt,
      })
    })
    next()
  }
}

export function apiRateLimit(options: RateLimitOptions): RequestHandler {
  const entries = new Map<string, RateLimitEntry>()
  const windowMs = Math.max(1_000, options.windowMs)
  const maxRequests = Math.max(1, options.maxRequests)
  let nextSweepAt = 0
  return (request, response, next) => {
    if (!request.path.startsWith('/api/')) return next()
    if (request.path === '/api/health' || request.path === '/api/readiness') return next()
    const key = request.ip || 'unknown'
    const now = Date.now()
    if (now >= nextSweepAt) {
      for (const [entryKey, entry] of entries) {
        if (entry.resetAt <= now) entries.delete(entryKey)
      }
      nextSweepAt = now + windowMs
    }
    const entry = entries.get(key)
    const current = !entry || entry.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : entry
    current.count += 1
    entries.set(key, current)
    if (current.count <= maxRequests) return next()

    response.setHeader('Retry-After', String(Math.max(1, Math.ceil((current.resetAt - now) / 1_000))))
    response.status(429).json({
      error: 'rate_limited', message: 'Prea multe cereri. Încearcă din nou în curând.',
    })
  }
}
