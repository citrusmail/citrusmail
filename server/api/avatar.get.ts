import { createHash } from 'node:crypto'
import { promises as dns } from 'node:dns'
import { defineEventHandler, getValidatedQuery } from 'nuxt/server'
import { z } from 'zod'

// Sender pictures, fetched by the server so the sender's image host never
// sees the reader's address or IP. A person's Gravatar first; then, for a
// company domain, the logo it publishes for mail clients (BIMI, the same
// logos Gmail and Apple Mail show), then the site's icon. Free-mail domains
// have no logo worth showing
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
    // Raster images only here: SVG is taken from BIMI alone, and checked
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

// BIMI logos are SVG Tiny PS: static shapes, no script, no outside
// references. Anything that isn't is refused, and what's served is sent with
// a policy that lets it draw and nothing else
const SVG_BANNED = /<\s*(script|foreignObject|iframe|embed|object|image|a|use|set|animate\w*|handler|audio|video)\b|<!(?:ENTITY|DOCTYPE)|\son[a-z]+\s*=|javascript:|(?:xlink:)?href\s*=\s*["'](?!#)|url\s*\(\s*["']?(?!#|data:)/i

async function fetchBimiLogo(url: string): Promise<Picture | null> {
  try {
    if (!url.startsWith('https://')) return null
    const response = await guardedFetch(false, 4000)(url)
    const type = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
    if (!response.ok || !['image/svg+xml', 'image/svg', 'text/xml', 'application/xml'].includes(type)) {
      await response.body?.cancel()
      return null
    }
    const body = await readLimitedBytes(response, 64 * 1024)
    if (!body) return null
    const svg = body.toString('utf8')
    if (!/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg\b/i.test(svg) || SVG_BANNED.test(svg)) return null
    return { body, type: 'image/svg+xml' }
  } catch {
    return null
  }
}

/** The logo URL a domain publishes at default._bimi, if any; the parent domain is tried too */
async function bimiLogoUrl(domain: string): Promise<string | undefined> {
  const labels = domain.split('.')
  const candidates = [domain]
  if (labels.length > 2) candidates.push(labels.slice(-2).join('.'))
  for (const name of candidates) {
    const records = await dns.resolveTxt(`default._bimi.${name}`).catch(() => [])
    for (const record of records) {
      const text = record.join('')
      if (!/^\s*v\s*=\s*BIMI1\s*;/i.test(text)) continue
      const logo = text.match(/(?:^|;)\s*l\s*=\s*([^;\s]+)/i)?.[1]
      if (logo) return logo
    }
  }
  return undefined
}

async function lookup(email: string): Promise<Picture | null> {
  const hash = createHash('sha256').update(email).digest('hex')
  const gravatar = await fetchImage(`https://gravatar.com/avatar/${hash}?s=96&d=404`)
  if (gravatar) return gravatar

  const domain = email.split('@')[1]!
  if (FREE_MAIL.has(domain)) return null

  const bimi = await bimiLogoUrl(domain)
  if (bimi) {
    const logo = await fetchBimiLogo(bimi)
    if (logo) return logo
  }

  // Google answers a missing icon with a 404, so a domain without one falls
  // back to initials instead of a generic globe. Tiny icons are placeholders
  const site = domain.split('.').slice(-2).join('.')
  return fetchImage(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(site)}&sz=128`, 200)
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
  const svg = entry.picture.type === 'image/svg+xml'
  return new Response(new Uint8Array(entry.picture.body), {
    headers: {
      'Content-Type': entry.picture.type,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
      // An SVG opened on its own could do no more than draw
      ...(svg ? { 'Content-Security-Policy': 'default-src \'none\'; style-src \'unsafe-inline\'; sandbox', 'Content-Disposition': 'inline; filename="logo.svg"' } : {})
    }
  })
})
