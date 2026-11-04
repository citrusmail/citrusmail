import { createError, defineEventHandler, getRequestHeader, getRequestURL } from 'nuxt/server'

/** The routes anyone may call: signing in, looking up servers, the session itself */
const PUBLIC = [/^\/api\/session$/, /^\/api\/discover$/, /^\/api\/_auth\//, /^\/api\/oauth\//]

const MB = 1024 * 1024
/** A message with attachments, base64-encoded; everything else is small JSON */
const LIMITS: [RegExp, number][] = [[/^\/api\/(send|drafts)$/, 40 * MB], [/^\/api\/background$/, 8 * MB], [/^\/api\/ai\//, 4 * MB], [/^\/api\//, 1 * MB]]

// Message HTML is shown in a frame of its own; remote images there are only
// loaded once the reader asks for them, and the frame's own policy enforces that
const CSP = [
  'default-src \'self\'',
  'script-src \'self\' \'unsafe-inline\'',
  'style-src \'self\' \'unsafe-inline\'',
  'img-src \'self\' data: blob: https: http:',
  'font-src \'self\' data:',
  'connect-src \'self\'',
  'frame-src \'self\'',
  'object-src \'none\'',
  'base-uri \'self\'',
  'form-action \'self\'',
  'frame-ancestors \'none\''
].join('; ')

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)

  if (!import.meta.dev) {
    const headers = event.res.headers
    // Brand files set a stricter policy of their own (an SVG logo can't run script)
    if (!url.pathname.startsWith('/brand/')) headers.set('Content-Security-Policy', CSP)
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Referrer-Policy', 'no-referrer')
    headers.set('X-Frame-Options', 'DENY')
    headers.set('Cross-Origin-Opener-Policy', 'same-origin')
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  }

  if (!url.pathname.startsWith('/api/')) return
  const method = event.req.method.toUpperCase()

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // Cross-site requests: the browser always names the page a request came
    // from on these methods, so anything not from this origin is refused
    const origin = getRequestHeader(event, 'origin')
    const site = getRequestHeader(event, 'sec-fetch-site')
    let sameOrigin = false
    try {
      sameOrigin = !!origin && new URL(origin).host === getRequestHeader(event, 'host')
    } catch {
      // Not a URL: treated as cross-site
    }
    if (!sameOrigin || (site && site !== 'same-origin')) {
      throw createError({ status: 403, message: 'Cross-site requests are not allowed' })
    }

    // A body must be JSON (no form posts) and must say how big it is
    const length = Number(getRequestHeader(event, 'content-length') ?? 0)
    const chunked = /chunked/i.test(getRequestHeader(event, 'transfer-encoding') ?? '')
    if (chunked) throw createError({ status: 411, message: 'Length required' })
    if (length > 0 && !/^application\/json\b/i.test(getRequestHeader(event, 'content-type') ?? '')) {
      throw createError({ status: 415, message: 'Requests must be JSON' })
    }
    const limit = LIMITS.find(([pattern]) => pattern.test(url.pathname))?.[1] ?? MB
    if (length > limit) throw createError({ status: 413, message: 'That request is too large' })
  }

  // Everything else needs a signed-in account, checked before any body is read
  if (!PUBLIC.some(pattern => pattern.test(url.pathname))) {
    await requireAccount(event)
  }
})
