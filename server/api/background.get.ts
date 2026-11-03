import { createError, defineEventHandler } from 'nuxt/server'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const stored = await readStore<{ image?: string } | null>(account, 'background', null)
  const match = stored?.image?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
  if (!match) throw createError({ status: 404, message: 'No background picture.' })
  event.res.headers.set('Content-Type', match[1]!)
  // The URL carries a version, so a new picture is a new address
  event.res.headers.set('Cache-Control', 'private, max-age=31536000, immutable')
  return Buffer.from(match[2]!, 'base64')
})
