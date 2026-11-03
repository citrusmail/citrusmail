import { createHash } from 'node:crypto'
import { defineEventHandler, getValidatedQuery } from 'nuxt/server'
import { z } from 'zod'

// Sender pictures, fetched by the server so the sender's image host never
// sees the reader's address or IP. A person's Gravatar first, then the logo
// of a company domain; free-mail domains have no logo worth showing
const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.de',
  'gmx.net', 'web.de', 'mail.com', 'yandex.com', 'yandex.ru', 'zoho.com', 'fastmail.com', 'hey.com', 'tutanota.com'
])

interface Picture { body: Buffer, type: string }

const PICTURE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'])

const cache = new Map<string, { picture: Picture | null, at: number }>()
const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

async function fetchImage(url: string, minBytes = 0): Promise<Picture | null> {
  try {
    const response = await guardedFetch(false, 4000)(url)
    // Raster images only: an SVG served from this origin could run script
    const type = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
    if (!response.ok || !PICTURE_TYPES.has(type)) {
      await response.body?.cancel()
      return null
    }
    const body = await readLimitedBytes(response, 256 * 1024)
    return body && body.length > minBytes ? { body, type } : null
  } catch {
    return null
  }
}

async function lookup(email: string): Promise<Picture | null> {
  const hash = createHash('sha256').update(email).digest('hex')
  const gravatar = await fetchImage(`https://gravatar.com/avatar/${hash}?s=96&d=404`)
  if (gravatar) return gravatar

  const domain = email.split('@')[1]!
  if (FREE_MAIL.has(domain)) return null
  // Google answers a missing icon with a 404, so a domain without one falls
  // back to initials instead of a generic globe. Tiny icons are placeholders
  const site = domain.split('.').slice(-2).join('.')
  return fetchImage(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(site)}&sz=64`, 200)
}

const querySchema = z.object({ email: z.email().transform(value => value.trim().toLowerCase()), v: z.string().max(10).optional() })

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const { email } = await getValidatedQuery(event, querySchema)

  // Your own picture, as set in Settings, wins over anything found online
  if (email === account.email.toLowerCase()) {
    const own = (await readStore<Partial<UserSettings>>(account, 'settings', {})).avatar
    const match = own?.match(/^data:(image\/[a-z]+);base64,(.+)$/)
    if (match) {
      return new Response(new Uint8Array(Buffer.from(match[2]!, 'base64')), {
        headers: { 'Content-Type': match[1]!, 'Cache-Control': 'private, no-cache', 'X-Content-Type-Options': 'nosniff' }
      })
    }
  }

  let entry = cache.get(email)
  // Pictures are kept a day, misses an hour
  if (!entry || Date.now() - entry.at > (entry.picture ? DAY : HOUR)) {
    entry = { picture: await lookup(email), at: Date.now() }
    if (cache.size > 5000) cache.delete(cache.keys().next().value!)
    cache.set(email, entry)
  }

  // A miss is cached for an hour, so initials don't ask on every render but a
  // failed lookup doesn't stick for long
  if (!entry.picture) {
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'private, max-age=3600' } })
  }
  return new Response(new Uint8Array(entry.picture.body), {
    headers: {
      'Content-Type': entry.picture.type,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff'
    }
  })
})
