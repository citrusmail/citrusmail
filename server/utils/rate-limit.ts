import type { RequestEvent } from 'nuxt/server'
import { createError, getRequestIP, useRuntimeConfig } from 'nuxt/server'

const hits = new Map<string, { count: number, reset: number }>()

/**
 * A fixed-window, per-instance limit keyed by client IP (or by `subject`, such
 * as an email address). Cheap on purpose: it only has to stop one client
 * hammering discovery or password guessing. Behind a reverse proxy set
 * NUXT_TRUST_PROXY=true so each visitor gets their own bucket.
 */
export function rateLimit(event: RequestEvent, bucket: string, limit: number, windowMs = 60_000, subject?: string) {
  const now = Date.now()
  const trustProxy = String(useRuntimeConfig().trustProxy) === 'true'
  const key = `${bucket}:${subject ?? getRequestIP(event, { xForwardedFor: trustProxy }) ?? 'unknown'}`
  const entry = hits.get(key)
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + windowMs })
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
    }
    return
  }
  if (++entry.count > limit) {
    throw createError({ status: 429, message: 'Too many attempts. Please wait a minute and try again.' })
  }
}
