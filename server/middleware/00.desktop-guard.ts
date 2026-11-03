import { createError, defineEventHandler, getRequestHeader } from 'nuxt/server'

/**
 * In the Mac app the server listens on 127.0.0.1, where any other program or
 * web page on the Mac can reach it. The app's window adds a secret header to
 * every request it makes (a new one each launch), and the Host must be the
 * loopback address itself, which also defeats DNS rebinding.
 */
export default defineEventHandler((event) => {
  const token = process.env.CITRUSMAIL_DESKTOP_TOKEN
  if (!token) return
  const host = getRequestHeader(event, 'host')
  const expected = `127.0.0.1:${process.env.NITRO_PORT}`
  if (host !== expected || getRequestHeader(event, 'x-citrusmail-desktop') !== token) {
    throw createError({ status: 403, message: 'Forbidden' })
  }
})
