import type { Open } from './tracking'
import { normalizeId } from './tracking'

/**
 * For Faivelo mailboxes, Faivelo serves the tracking image: it's already on
 * the internet (faivelo.com/api/t/<id>, as for Faivelo's own webmail) and
 * filters out scanners. CitrusMail signs in to its read-receipts API with the mailbox's
 * own address and password, creates a receipt before sending, and asks for
 * new opens whenever it checks for mail. So this works from the desktop app
 * and localhost too
 */
const POLL_EVERY = 60_000
const lastPoll = new Map<string, number>()

/** Faivelo's address, when NUXT_FAIVELO_URL turns this on; empty otherwise */
export function faiveloBase(): string {
  return String(useRuntimeConfig().faiveloUrl || '').trim().replace(/\/+$/, '')
}

function faiveloFetch<T>(account: AccountSettings, init: { method: 'GET' | 'POST', query?: Record<string, string>, body?: object }) {
  const base = faiveloBase()
  if (!base) throw createError({ statusCode: 404, message: 'Faivelo tracking is off on this server' })
  return $fetch<{ success: boolean, data: T }>(`${base}/api/client/read-receipts`, {
    method: init.method,
    query: init.query,
    body: init.body,
    timeout: 10_000,
    headers: { authorization: `Basic ${Buffer.from(`${account.email}:${account.password}`).toString('base64')}` }
  })
}

/** Creates the receipt for a message about to go out and returns its image URL */
export async function faiveloPixel(account: AccountSettings, messageId: string, message: OutgoingMessage): Promise<string> {
  const people = [...message.to, ...(message.cc ?? [])].map(a => a.name ? `${a.name} <${a.address}>` : a.address)
  const { data } = await faiveloFetch<{ pixelUrl: string }>(account, {
    method: 'POST',
    body: { messageId, recipient: people.join(', ').slice(0, 1000) || '(undisclosed)', subject: message.subject.slice(0, 998) }
  })
  return data.pixelUrl
}

/** Settings → Tracking's check: Faivelo accepts this mailbox's sign-in */
export async function checkFaivelo(account: AccountSettings): Promise<{ ok: boolean, message: string }> {
  try {
    await faiveloFetch(account, { method: 'GET', query: { since: new Date().toISOString() } })
    return { ok: true, message: 'Faivelo will track opens for this mailbox.' }
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    if (status === 401) return { ok: false, message: 'Faivelo didn’t accept this mailbox’s password. Sign out and in again with the current one.' }
    if (status === 404) return { ok: false, message: 'Faivelo doesn’t offer this yet. Try again after its next update.' }
    return { ok: false, message: 'Faivelo couldn’t be reached. Check your connection and try again.' }
  }
}

/** Pulls opens Faivelo recorded since the last look, at most once a minute */
export async function syncFaiveloOpens(account: AccountSettings): Promise<number> {
  const receipts = (await readStore<Partial<UserSettings>>(account, 'settings', {})).receipts
  if (!faiveloBase() || !trackingReady(receipts) || receipts?.provider !== 'faivelo') return 0
  const key = storeId(account)
  if (Date.now() - (lastPoll.get(key) ?? 0) < POLL_EVERY) return 0
  lastPoll.set(key, Date.now())

  const cursor = await readLocal<{ since: string }>(account, 'faivelo-opens')
  const { data } = await faiveloFetch<{ opens: { messageId: string, readAt: string, maybe: boolean }[] }>(account, {
    method: 'GET',
    query: { since: cursor?.since ?? new Date(Date.now() - 30 * 86_400_000).toISOString() }
  })
  if (!data.opens.length) return 0

  const opens = await readLocal<Record<string, Open>>(account, 'opens') ?? {}
  for (const open of data.opens) {
    const id = normalizeId(open.messageId)
    const current = opens[id]
    if (!current || (current.maybe && !open.maybe)) opens[id] = { at: open.readAt, maybe: open.maybe }
  }
  await writeLocal(account, 'opens', Object.fromEntries(Object.entries(opens).slice(-5000)))
  await writeLocal(account, 'faivelo-opens', { since: data.opens[data.opens.length - 1]!.readAt })
  return data.opens.length
}
