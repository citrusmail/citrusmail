import {
  JMAP_CONTENT_TYPE, JMAP_RULE_MARK, JMAP_SYNC_FOLDER, findJmapRole, isJmapReport, isJmapSyncFolder, jmapFlagPatch, jmapFromFilter,
  jmapMovePatch, jmapRequest, jmapRuleFilter, jmapSetResult
} from './jmap'
import type { JmapContext, JmapEmail, JmapMailbox } from './jmap'
import { jmapOps } from './mail-jmap'

/**
 * What CitrusMail does with a mailbox beyond reading it, over JMAP: sender
 * lists, rules, collecting delivery and read reports, and keeping settings in
 * the mailbox. The same jobs as senders.ts, rules.ts, receipts.ts and
 * sync.ts do over IMAP, which call these for JMAP accounts
 */
// Read at call time: mail-jmap.ts imports this module back (through Nitro's
// auto-imports), so jmapOps isn't there yet while the modules load
const ops = () => jmapOps

type Filter = Record<string, unknown>

const inMailbox = (id: string, filter: Filter): Filter => ({ operator: 'AND', conditions: [{ inMailbox: id }, filter] })

/** Emails matching a filter, newest first, with the properties asked for */
async function find(ctx: JmapContext, filter: Filter, properties: string[], limit = 500): Promise<JmapEmail[]> {
  const id = await ops().accountId(ctx)
  const responses = await jmapRequest(ctx, [
    ['Email/query', { accountId: id, filter, sort: [{ property: 'receivedAt', isAscending: false }], limit }, 'q'],
    ['Email/get', { 'accountId': id, '#ids': { resultOf: 'q', name: 'Email/query', path: '/ids' }, properties }, 'g']
  ])
  return (responses.get('g')?.list as JmapEmail[] | undefined) ?? []
}

async function moveAll(ctx: JmapContext, emails: JmapEmail[], from: string, to: string, markRead = false): Promise<number> {
  if (!emails.length || from === to) return 0
  const patch = { ...jmapMovePatch(from, to), ...(markRead ? jmapFlagPatch({ unread: false }) : {}) }
  await ops().updateEmails(ctx, Object.fromEntries(emails.map(email => [email.id, patch])))
  return emails.length
}

/* ------------------------------------------------------------------ */
/* Sender lists (senders.ts)                                           */
/* ------------------------------------------------------------------ */

/** Blocked senders leave the Inbox for Junk (or Trash); allowed senders in Junk come back */
export async function jmapApplySenderLists(account: AccountSettings, lists: SenderLists): Promise<number> {
  const ctx = ops().context(account)
  const list = await ops().mailboxes(ctx)
  const inbox = findJmapRole(list, 'inbox')
  const junk = findJmapRole(list, 'junk')
  const bin = lists.blockAction === 'trash' ? findJmapRole(list, 'trash') : junk

  let moved = 0
  const screen = async (from: JmapMailbox, entries: string[], to: JmapMailbox) => {
    // Long OR chains trip some servers, so a big list goes in slices
    for (let i = 0; i < entries.length; i += 15) {
      const slice = entries.slice(i, i + 15)
      const filter = jmapFromFilter(slice)
      if (!filter) continue
      // FROM is a substring match, which can catch more than the list means: check each sender
      const exact = (await find(ctx, inMailbox(from.id, filter), ['id', 'from']))
        .filter(email => senderMatches(slice, email.from?.[0]?.email ?? undefined))
      moved += await moveAll(ctx, exact, from.id, to.id)
    }
  }
  if (inbox && bin && lists.blocked.length) await screen(inbox, lists.blocked, bin)
  if (inbox && junk && lists.allowed.length) await screen(junk, lists.allowed, inbox)
  return moved
}

/* ------------------------------------------------------------------ */
/* Rules (rules.ts)                                                    */
/* ------------------------------------------------------------------ */

/** The Inbox as rules last left it: its newest message and count, so an unchanged Inbox skips the rules */
export async function jmapInboxState(account: AccountSettings): Promise<string> {
  const ctx = ops().context(account)
  const inbox = findJmapRole(await ops().mailboxes(ctx), 'inbox')
  if (!inbox) return ''
  const result = await ops().call(ctx, 'Email/query', { filter: { inMailbox: inbox.id }, sort: [{ property: 'receivedAt', isAscending: false }], limit: 1, calculateTotal: true })
  return `${(result.ids as string[] | undefined)?.[0] ?? ''}:${result.total ?? ''}`
}

/** Where a new rule starts: mail received from now on */
export function jmapRuleMark(): MailRule['after'] {
  const now = Date.now()
  return { validity: JMAP_RULE_MARK, uid: now, at: now }
}

/**
 * Files Inbox mail into folders by the rules. The most specific folder wins
 * (a rule for a folder inside another rule's folder goes first), and a rule
 * that applies to existing mail also sorts what its parent's rule filed
 */
export async function jmapRunRules(account: AccountSettings, all: MailRule[]): Promise<number> {
  const ctx = ops().context(account)
  const list = await ops().mailboxes(ctx)
  const inbox = findJmapRole(list, 'inbox')
  if (!inbox) return 0
  const byId = new Map(list.map(mailbox => [mailbox.id, mailbox]))
  const ancestors = (id: string) => {
    const chain: string[] = []
    let parent = byId.get(id)?.parentId
    while (parent && chain.length < 50) {
      chain.push(parent)
      parent = byId.get(parent)?.parentId
    }
    return chain
  }
  const parentsOf = (rule: MailRule) => [...new Set(all.map(other => other.folder).filter(folder => ancestors(rule.folder).includes(folder)))]
  const rules = all
    .map((rule, index) => ({ rule, index, depth: parentsOf(rule).length }))
    .sort((a, b) => b.depth - a.depth || a.index - b.index)
    .map(entry => entry.rule)

  const file = async (from: string, rule: MailRule, filter: Filter) =>
    moveAll(ctx, await find(ctx, inMailbox(from, filter), ['id']), from, rule.folder, rule.markRead)

  let moved = 0
  for (const rule of rules) {
    const filter = jmapRuleFilter(rule)
    if (filter && byId.has(rule.folder)) moved += await file(inbox.id, rule, filter)
  }
  for (const rule of rules.filter(rule => !rule.after)) {
    const filter = jmapRuleFilter(rule)
    if (!filter || !byId.has(rule.folder)) continue
    for (const parent of parentsOf(rule)) moved += await file(parent, rule, filter).catch(() => 0)
  }
  return moved
}

/* ------------------------------------------------------------------ */
/* Delivery and read reports (receipts.ts)                             */
/* ------------------------------------------------------------------ */

/** Reports are small; a bigger message with a report's Content-Type isn't read */
const MAX_REPORT_BYTES = 256 * 1024

/** Report messages in the Inbox received after `since` (ms), each with the start of its source */
export async function jmapFindReports(account: AccountSettings, since: number): Promise<{ id: string, at: string, source: string }[]> {
  const ctx = ops().context(account)
  const inbox = findJmapRole(await ops().mailboxes(ctx), 'inbox')
  if (!inbox) return []
  const filter: Filter = { operator: 'AND', conditions: [{ inMailbox: inbox.id }, { after: new Date(since).toISOString() }] }
  const emails = (await find(ctx, filter, ['id', 'blobId', 'size', 'receivedAt', JMAP_CONTENT_TYPE], 300))
    .filter(email => isJmapReport(email) && (email.size ?? 0) <= MAX_REPORT_BYTES)
  const reports = []
  for (const email of emails) {
    const raw = await ops().source(ctx, email).catch(() => undefined)
    if (raw) reports.push({ id: email.id, at: email.receivedAt ?? new Date().toISOString(), source: raw.subarray(0, 64 * 1024).toString('utf8') })
  }
  return reports
}

export async function jmapMarkRead(account: AccountSettings, ids: string[]): Promise<void> {
  if (ids.length) await ops().updateEmails(ops().context(account), Object.fromEntries(ids.map(id => [id, jmapFlagPatch({ unread: false })])))
}

/* ------------------------------------------------------------------ */
/* Settings in the mailbox (sync.ts)                                   */
/* ------------------------------------------------------------------ */

/** The newest settings message, or undefined when there's none yet */
export async function jmapReadSettings(account: AccountSettings): Promise<Buffer | undefined> {
  const ctx = ops().context(account)
  const folder = (await ops().mailboxes(ctx)).find(isJmapSyncFolder)
  if (!folder) return undefined
  const [newest] = await find(ctx, { inMailbox: folder.id }, ['id', 'blobId', 'size'], 1)
  return newest ? ops().source(ctx, newest) : undefined
}

/** Saves a new settings message and removes the older ones; the folder is made unsubscribed, so other apps hide it */
export async function jmapWriteSettings(account: AccountSettings, raw: Buffer): Promise<void> {
  const ctx = ops().context(account)
  let folder = (await ops().mailboxes(ctx)).find(isJmapSyncFolder)
  if (!folder) {
    const create = (extra: object) => ops().call(ctx, 'Mailbox/set', { create: { new: { name: JMAP_SYNC_FOLDER, parentId: null, ...extra } } })
      .then(result => String(jmapSetResult(result, 'created', 'new').id))
    const id = await create({ isSubscribed: false }).catch(() => create({}))
    folder = { id, name: JMAP_SYNC_FOLDER }
  }
  const id = await ops().importEmail(ctx, raw, folder.id, { $seen: true })
  const older = (await find(ctx, { inMailbox: folder.id }, ['id'], 50)).filter(email => email.id !== id)
  if (older.length) await ops().call(ctx, 'Email/set', { destroy: older.map(email => email.id) })
}

/* ------------------------------------------------------------------ */
/* Subscriptions (unsubscribe.ts)                                      */
/* ------------------------------------------------------------------ */

const LIST_HEADERS = ['header:List-Unsubscribe', 'header:List-Unsubscribe-Post'] as const

/**
 * The newest `scan` Inbox messages that carry List-Unsubscribe, with those
 * headers as text. Fetched in batches, under servers' usual Email/get limit
 */
export async function jmapListHeaders(account: AccountSettings, scan: number): Promise<{ id: string, name?: string, address?: string, date: string, headers: string }[]> {
  const ctx = ops().context(account)
  const inbox = findJmapRole(await ops().mailboxes(ctx), 'inbox')
  if (!inbox) return []
  const query = await ops().call(ctx, 'Email/query', { filter: { inMailbox: inbox.id }, sort: [{ property: 'receivedAt', isAscending: false }], limit: scan })
  const ids = (query.ids as string[] | undefined) ?? []
  const found = []
  for (let i = 0; i < ids.length; i += 250) {
    const result = await ops().call(ctx, 'Email/get', { ids: ids.slice(i, i + 250), properties: ['id', 'from', 'receivedAt', ...LIST_HEADERS] })
    for (const email of (result.list as (JmapEmail & Record<string, unknown>)[] | undefined) ?? []) {
      const [list, post] = LIST_HEADERS.map(name => email[name])
      if (typeof list !== 'string') continue
      const sender = email.from?.[0]
      found.push({
        id: email.id,
        name: sender?.name ?? undefined,
        address: sender?.email ?? undefined,
        date: email.receivedAt ?? new Date(0).toISOString(),
        headers: `List-Unsubscribe:${list}\r\n${typeof post === 'string' ? `List-Unsubscribe-Post:${post}\r\n` : ''}`
      })
    }
  }
  return found
}
