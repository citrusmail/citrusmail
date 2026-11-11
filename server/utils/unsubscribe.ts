import { simpleParser } from 'mailparser'
import { createError } from 'nuxt/server'
import { inBackground, withMailbox } from './imap'

/**
 * Leaving mailing lists, from the List-Unsubscribe header (RFC 2369). When the
 * sender supports one-click (RFC 8058) the server makes that request itself;
 * when it gives an address, the server sends the unsubscribe email; a plain
 * web link is handed back to open in the browser, since only the sender's
 * page knows what it needs
 */
export interface UnsubscribeTargets {
  http?: string
  mailto?: string
  oneClick: boolean
}

export function parseUnsubscribe(header?: string, post?: string): UnsubscribeTargets | undefined {
  if (!header) return undefined
  const entries = [...header.matchAll(/<\s*([^>]+?)\s*>/g)].map(match => match[1]!.replace(/\s+/g, ''))
  const http = entries.find(entry => /^https?:\/\//i.test(entry))
  const mailto = entries.find(entry => /^mailto:/i.test(entry))
  if (!http && !mailto) return undefined
  return { http, mailto, oneClick: Boolean(http?.startsWith('https:') && /List-Unsubscribe=One-Click/i.test(post ?? '')) }
}

export function unsubscribeMethod(targets: UnsubscribeTargets): UnsubscribeMethod {
  if (targets.oneClick) return 'one-click'
  if (targets.mailto) return 'email'
  return 'link'
}

/** The two headers, from raw header text (as a partial FETCH returns them) */
export function unsubscribeFromHeaders(raw: string): UnsubscribeTargets | undefined {
  const unfolded = raw.replace(/\r?\n[ \t]+/g, ' ')
  const value = (name: string) => unfolded.match(new RegExp(`^${name}:\\s*(.*)$`, 'im'))?.[1]?.trim()
  return parseUnsubscribe(value('List-Unsubscribe'), value('List-Unsubscribe-Post'))
}

function mailtoMessage(mailto: string): OutgoingMessage | undefined {
  try {
    const url = new URL(mailto)
    const address = decodeURIComponent(url.pathname)
    if (!/^[^\s@]+@[^\s@]+$/.test(address)) return undefined
    const subject = url.searchParams.get('subject') || 'unsubscribe'
    const body = url.searchParams.get('body') || 'unsubscribe'
    return { to: [{ address }], subject, html: `<p>${body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`, text: body }
  } catch {
    return undefined
  }
}

async function readTargets(account: AccountSettings, folder: string, id: string) {
  const source = await mailFor(account).getSource(folder, id)
  const parsed = await simpleParser(source, { skipHtmlToText: true, skipTextToHtml: true, skipImageLinks: true })
  const line = (key: string) => parsed.headerLines.find(header => header.key === key)?.line.replace(/^[^:]+:\s*/, '')
  return { targets: unsubscribeFromHeaders(`List-Unsubscribe: ${line('list-unsubscribe') ?? ''}\nList-Unsubscribe-Post: ${line('list-unsubscribe-post') ?? ''}`), from: flattenAddresses(parsed.from)[0] }
}

export async function unsubscribe(account: AccountSettings, folder: string, id: string): Promise<UnsubscribeResult> {
  const { targets, from } = await readTargets(account, folder, id)
  if (!targets) throw createError({ status: 400, message: 'This message has no unsubscribe link.' })
  const method = unsubscribeMethod(targets)
  let done = false

  if (targets.oneClick && targets.http) {
    const response = await guardedFetch(false, 15_000)(targets.http, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'CitrusMail (one-click unsubscribe)' },
      body: 'List-Unsubscribe=One-Click'
    }).catch(() => undefined)
    await response?.body?.cancel()
    done = Boolean(response && response.status < 400)
  }

  if (!done && targets.mailto) {
    const message = mailtoMessage(targets.mailto)
    if (message) {
      await sendMail(account, message)
      done = true
    }
  }

  if (done && from?.address) {
    const list = await readLocal<Record<string, string>>(account, 'unsubscribed') ?? {}
    list[from.address.toLowerCase()] = new Date().toISOString()
    await writeLocal(account, 'unsubscribed', list)
  }
  if (!done && !targets.http) throw createError({ status: 502, message: 'The sender didn\'t accept the unsubscribe request.' })
  return { done, method, url: done ? undefined : targets.http }
}

/**
 * Everyone sending you list mail, from the newest few hundred messages in the
 * Inbox: only headers are fetched, so this is quick even on a big mailbox
 */
// Reads hundreds of headers, so it runs on the background connection
export function listSubscriptions(account: AccountSettings, scan = 800): Promise<Subscription[]> {
  return inBackground(() => scanSubscriptions(account, scan))
}

async function scanSubscriptions(account: AccountSettings, scan: number): Promise<Subscription[]> {
  // Reads IMAP headers in bulk; the page is only offered for IMAP mailboxes
  if (account.incoming.protocol !== 'imap') return []
  const unsubscribed = await readLocal<Record<string, string>>(account, 'unsubscribed') ?? {}
  const found = await withMailbox(account, 'INBOX', async (client) => {
    const exists = client.mailbox ? client.mailbox.exists : 0
    if (!exists) return []
    const range = `${Math.max(1, exists - scan + 1)}:*`
    return client.fetchAll(range, { uid: true, envelope: true, headers: ['list-unsubscribe', 'list-unsubscribe-post'] })
  })

  const bySender = new Map<string, Subscription>()
  for (const message of found) {
    const targets = message.headers ? unsubscribeFromHeaders(message.headers.toString('utf8')) : undefined
    const sender = message.envelope?.from?.[0]
    if (!targets || !sender?.address) continue
    const address = sender.address.toLowerCase()
    const date = new Date(message.envelope?.date ?? 0).toISOString()
    const known = bySender.get(address)
    if (known) {
      known.count++
      if (date > known.lastDate) Object.assign(known, { lastDate: date, id: String(message.uid), method: unsubscribeMethod(targets), name: sender.name || known.name })
      continue
    }
    bySender.set(address, {
      address,
      name: sender.name || undefined,
      count: 1,
      lastDate: date,
      folder: 'INBOX',
      id: String(message.uid),
      method: unsubscribeMethod(targets),
      unsubscribedAt: unsubscribed[address]
    })
  }
  return [...bySender.values()].sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
}
