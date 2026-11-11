import { randomBytes } from 'node:crypto'
import { faiveloBase, faiveloPixel } from './faivelo-receipts'

/**
 * Open tracking with an image, for installs reachable from the internet
 * (Settings → Tracking). Each tracked message gets its own 1×1 image on this
 * server; when the recipient's mail app loads it, that's an open. It's served
 * over https from one plain URL with no redirects, and only for messages you
 * chose to track, which is what keeps filters from minding it
 */
interface Pixel {
  /** storeId of the account that sent it */
  store: string
  messageId: string
  sentAt: number
}

export interface Open { at: string, maybe: boolean }

const MAX_ENTRIES = 5000
const trim = <T>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).slice(-MAX_ENTRIES))

export const normalizeId = (id: string) => `<${id.trim().replace(/^<|>$/g, '').toLowerCase()}>`

/** A transparent 1×1 GIF */
export const PIXEL_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

/** Remembers a message as tracked, so the reports that come back for it are picked up */
export async function markTracked(account: AccountSettings, messageId: string) {
  const tracked = await readLocal<Record<string, number>>(account, 'tracked') ?? {}
  tracked[normalizeId(messageId)] = Date.now()
  await writeLocal(account, 'tracked', trim(tracked))
}

export async function readTracked(account: AccountSettings) {
  return await readLocal<Record<string, number>>(account, 'tracked') ?? {}
}

/** The image to add to a tracked message, when Settings → Tracking has it set up */
export async function pixelFor(account: AccountSettings, messageId: string, message: OutgoingMessage): Promise<string | undefined> {
  const settings = (await readStore<Partial<UserSettings>>(account, 'settings', {})).receipts
  if (!trackingReady(settings)) return undefined
  let src: string
  if (settings!.provider === 'faivelo') {
    // Faivelo tracking was turned off on this server since it was set up
    if (!faiveloBase()) return undefined
    src = await faiveloPixel(account, messageId, message)
  } else {
    const token = randomBytes(18).toString('base64url')
    await useStorage('citrusmail').setItem(`pixel:${token}`, { store: storeId(account), messageId: normalizeId(messageId), sentAt: Date.now() } satisfies Pixel)
    src = `${settings!.origin!.replace(/\/+$/, '')}/r/${token}.gif`
  }
  return `<img src="${src}" width="1" height="1" alt="" style="border:0;width:1px;height:1px">`
}

/**
 * Apple Mail loads every image when mail arrives (Apple's own network,
 * 17.0.0.0/8), and security scanners open links and images within seconds of
 * delivery; those count as "maybe". Gmail and Yahoo fetch through their
 * proxies only when the message is actually opened
 */
function isMaybe(pixel: Pixel, ip: string, agent: string) {
  if (/GoogleImageProxy|YahooMailProxy/i.test(agent)) return false
  if (/^(::ffff:)?17\./.test(ip)) return true
  return Date.now() - pixel.sentAt < 30_000
}

export async function recordOpen(token: string, ip: string, agent: string) {
  const storage = useStorage('citrusmail')
  const pixel = await storage.getItem<Pixel>(`pixel:${token}`)
  if (!pixel) return
  const key = `${pixel.store}:opens.json`
  const opens = await storage.getItem<Record<string, Open>>(key) ?? {}
  const current = opens[pixel.messageId]
  const maybe = isMaybe(pixel, ip, agent)
  // The first open counts, unless all that came before might have been a machine
  if (current && (!current.maybe || maybe)) return
  opens[pixel.messageId] = { at: new Date().toISOString(), maybe }
  await storage.setItem(key, trim(opens))
}

export async function readOpens(account: AccountSettings) {
  return await readLocal<Record<string, Open>>(account, 'opens') ?? {}
}
