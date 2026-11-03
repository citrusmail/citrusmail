import { defineEventHandler, getRequestHeader, getRequestIP, getRouterParam } from 'nuxt/server'

// The tracking image in tracked messages (see tracking.ts). Always answers
// with the same tiny GIF, whatever the token, so it gives nothing away.
// check.gif is what Settings → Tracking loads to see the address works
export default defineEventHandler(async (event) => {
  const file = getRouterParam(event, 'file') ?? ''
  const token = /^([\w-]{16,40})\.gif$/.exec(file)?.[1]
  if (token) {
    const ip = getRequestIP(event, { xForwardedFor: true }) ?? ''
    await recordOpen(token, ip, getRequestHeader(event, 'user-agent') ?? '').catch(() => {})
  }
  const headers = event.res.headers
  headers.set('Content-Type', 'image/gif')
  headers.set('Cache-Control', 'no-store, max-age=0')
  headers.set('X-CitrusMail-Image', '1')
  return PIXEL_GIF
})
