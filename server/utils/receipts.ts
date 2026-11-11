import type { SearchObject } from 'imapflow'
import { withMailbox } from './imap'
import { normalizeId, readOpens, readTracked } from './tracking'

/**
 * Reports that come back by mail for messages you tracked: read receipts
 * (RFC 8098) when the recipient's app says it was shown, and delivery
 * reports (RFC 3464) when their server accepted it or it bounced. Only
 * reports for tracked messages are read; each is then marked read, since the
 * badge on the sent message says it all
 */
interface ReportState {
  validity: string
  /** The Inbox UID scanned up to */
  next: number
  delivered: Record<string, string>
  opened: Record<string, string>
  failed: Record<string, string>
}

type Kind = 'delivered' | 'opened' | 'failed'
const EMPTY: ReportState = { validity: '', next: 1, delivered: {}, opened: {}, failed: {} }
const MAX_ENTRIES = 5000

const REPORTS: SearchObject = { or: [{ header: { 'content-type': 'disposition-notification' } }, { header: { 'content-type': 'delivery-status' } }] }

/** Which message a report is about, and what it says */
export function parseReport(source: string): { id: string, kind: Kind } | undefined {
  // Header lines in the report part can be folded onto the next line
  const text = source.replace(/\r?\n[ \t]+/g, ' ')
  const field = (name: string, from = text) => new RegExp(`^${name}:\\s*(.+)$`, 'im').exec(from)?.[1]?.trim()

  const disposition = field('Disposition')
  if (disposition) {
    const original = field('Original-Message-ID')
    return original && /\bdisplayed\b/i.test(disposition) ? { id: normalizeId(original), kind: 'opened' } : undefined
  }

  // A delivery report names the message by the envelope id it was sent with,
  // or failing that by the Message-ID in the headers it returns
  const returned = text.search(/^Content-Type:\s*(text\/rfc822-headers|message\/rfc822)/im)
  const id = field('Original-Envelope-Id') ?? (returned >= 0 ? field('Message-ID', text.slice(returned)) : undefined)
  const action = field('Action')?.toLowerCase() ?? ''
  if (!id) return undefined
  // Relayed: handed to a server that doesn't report back, which means it got there
  if (/^(delivered|relayed|expanded)/.test(action)) return { id: normalizeId(id), kind: 'delivered' }
  if (action.startsWith('failed')) return { id: normalizeId(id), kind: 'failed' }
  return undefined
}

/** Scans Inbox mail that arrived since the last scan. Returns how many reports it used */
export async function collectReceipts(account: AccountSettings): Promise<number> {
  if (account.incoming.protocol === 'pop3') return 0
  const tracked = await readTracked(account)
  const state = { ...EMPTY, ...await readLocal<ReportState>(account, 'receipts') }
  if (account.incoming.protocol === 'jmap') return collectJmap(account, tracked, state)

  const found = await withMailbox(account, 'INBOX', async (client) => {
    const validity = String(client.mailbox ? client.mailbox.uidValidity : '')
    const next = client.mailbox ? Number(client.mailbox.uidNext) : 1
    const from = state.validity === validity ? state.next : 1
    const reports: { uid: number, id: string, kind: Kind, at: string }[] = []
    if (from >= next || !Object.keys(tracked).length) return { validity, next, reports }

    const uids = await client.search({ uid: `${from}:*`, ...REPORTS }, { uid: true }).catch(() => false)
    if (Array.isArray(uids) && uids.length) {
      for await (const msg of client.fetch(uids.slice(-300).join(','), { uid: true, source: { maxLength: 64 * 1024 }, internalDate: true }, { uid: true })) {
        const report = msg.source ? parseReport(msg.source.toString('utf8')) : undefined
        if (report && tracked[report.id]) reports.push({ uid: msg.uid, ...report, at: new Date(msg.internalDate ?? Date.now()).toISOString() })
      }
      if (reports.length) await client.messageFlagsAdd(reports.map(r => r.uid).join(','), ['\\Seen'], { uid: true }).catch(() => {})
    }
    return { validity, next, reports }
  })

  // The first report of each kind is the one that counts
  for (const report of found.reports) state[report.kind][report.id] ??= report.at
  const trim = (record: Record<string, string>) => Object.fromEntries(Object.entries(record).slice(-MAX_ENTRIES))
  await writeLocal<ReportState>(account, 'receipts', {
    validity: found.validity,
    next: found.next,
    delivered: trim(state.delivered),
    opened: trim(state.opened),
    failed: trim(state.failed)
  })
  return found.reports.length
}

/**
 * JMAP has no UIDs that grow: the scan goes by time instead (`validity`
 * 'jmap', `next` in ms), starting a little before the last one ended so a
 * report that arrived while it ran isn't missed. Seeing one twice is harmless
 */
async function collectJmap(account: AccountSettings, tracked: Record<string, unknown>, state: ReportState): Promise<number> {
  const started = Date.now()
  if (!Object.keys(tracked).length) {
    await writeLocal<ReportState>(account, 'receipts', { ...state, validity: 'jmap', next: started })
    return 0
  }
  const since = state.validity === 'jmap' ? state.next : 0
  const used: { id: string, report: { id: string, kind: Kind }, at: string }[] = []
  for (const found of await jmapFindReports(account, since)) {
    const report = parseReport(found.source)
    if (report && tracked[report.id]) used.push({ id: found.id, report, at: found.at })
  }
  await jmapMarkRead(account, used.map(entry => entry.id)).catch(() => {})
  for (const { report, at } of used) state[report.kind][report.id] ??= at
  const trim = (record: Record<string, string>) => Object.fromEntries(Object.entries(record).slice(-MAX_ENTRIES))
  await writeLocal<ReportState>(account, 'receipts', {
    validity: 'jmap',
    next: started - 10 * 60_000,
    delivered: trim(state.delivered),
    opened: trim(state.opened),
    failed: trim(state.failed)
  })
  return used.length
}

/** Adds what's known to tracked messages you sent */
export async function withReceipts<T extends MessageSummary>(account: AccountSettings, messages: T[]): Promise<T[]> {
  const tracked = await readTracked(account)
  if (!Object.keys(tracked).length) return messages
  const [state, opens] = await Promise.all([readLocal<ReportState>(account, 'receipts'), readOpens(account)])
  const reports = { ...EMPTY, ...state }

  return messages.map((message) => {
    const id = message.messageId && normalizeId(message.messageId)
    if (!id || !tracked[id]) return message
    const image = opens[id]
    // A read receipt is the recipient's own app saying so; it outranks a maybe
    const opened = reports.opened[id] ?? image?.at
    const receipt: ReceiptStatus = {
      delivered: reports.delivered[id] ?? opened,
      opened,
      maybe: !reports.opened[id] && image?.maybe ? true : undefined,
      failed: reports.failed[id]
    }
    return { ...message, receipt }
  })
}
