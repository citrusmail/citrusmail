import type { FetchMessageObject, ImapFlow, ListResponse, MessageStructureObject, SearchObject } from 'imapflow'
import { createError } from 'nuxt/server'
import { simpleParser } from 'mailparser'
import { accountKey, withImap, withMailbox } from './imap'
import { folderTimes, forgetUids, orderPage, sortTime } from './mail-order'

const PAGE = 50
const PREVIEW_BYTES = 2048

/* ------------------------------------------------------------------ */
/* Folders                                                             */
/* ------------------------------------------------------------------ */

const SPECIAL_USE: Record<string, FolderRole> = {
  '\\Inbox': 'inbox', '\\Sent': 'sent', '\\Drafts': 'drafts', '\\Junk': 'junk',
  '\\Trash': 'trash', '\\Archive': 'archive', '\\Flagged': 'flagged'
}

const NAME_ROLES: [FolderRole, RegExp][] = [
  ['sent', /^(sent|sent items|sent mail|sent messages|gesendet|gesendete elemente|envoy[ée]s|[ée]l[ée]ments envoy[ée]s|enviados|inviata|posta inviata)$/i],
  ['drafts', /^(drafts?|entw[üu]rfe|brouillons|borradores|bozze)$/i],
  ['junk', /^(junk|spam|junk e-?mail|bulk mail|courrier ind[ée]sirable|correo no deseado|posta indesiderata)$/i],
  ['trash', /^(trash|deleted items|deleted messages|bin|papierkorb|gel[öo]schte elemente|corbeille|papelera|cestino)$/i],
  ['archive', /^(archives?|archiv|archivio|archivo)$/i]
]

const ORDER: FolderRole[] = ['inbox', 'drafts', 'sent', 'archive', 'junk', 'trash']

/** Gmail's "[Gmail]/All Mail" is where an archived message lives */
function isGmailAll(entry: ListResponse) {
  return entry.specialUse === '\\All' && /^\[(Gmail|Google Mail)\]/.test(entry.path)
}

/** Where CitrusMail keeps its settings inside the mailbox, so they follow you between devices */
export const SYNC_FOLDER = 'CitrusMail Settings'

export function toFolders(list: ListResponse[]): Folder[] {
  const visible = list.filter(e => !e.flags.has('\\Noselect') && !e.flags.has('\\NonExistent') && e.path !== SYNC_FOLDER && e.name !== SYNC_FOLDER)
  const roles = new Map<ListResponse, FolderRole>()
  for (const entry of visible) {
    const role = entry.path.toUpperCase() === 'INBOX' ? 'inbox' : SPECIAL_USE[entry.specialUse ?? '']
    if (role) roles.set(entry, role)
  }
  const taken = new Set(roles.values())
  for (const [role, pattern] of NAME_ROLES) {
    if (taken.has(role)) continue
    const entry = visible.find(e => !roles.has(e) && pattern.test(e.name))
    if (entry) {
      roles.set(entry, role)
      taken.add(role)
    }
  }

  const paths = new Set(visible.map(e => e.path))
  const folders = visible.map((entry): Folder => {
    const role = roles.get(entry)
    const parts = entry.delimiter ? entry.path.split(entry.delimiter) : [entry.path]
    // Count only ancestors that are shown, and never INBOX ("INBOX.Sent" is a top-level folder)
    let depth = 0
    for (let i = 1; i < parts.length; i++) {
      const ancestor = parts.slice(0, i).join(entry.delimiter)
      if (ancestor.toUpperCase() !== 'INBOX' && paths.has(ancestor)) depth++
    }
    return {
      path: entry.path,
      name: role === 'inbox' ? 'Inbox' : entry.name,
      role,
      unread: entry.status?.unseen ?? 0,
      depth: role ? 0 : depth
    }
  })

  const rank = (f: Folder) => (f.role && ORDER.includes(f.role) ? ORDER.indexOf(f.role) : ORDER.length)
  const sortKey = (f: Folder) => f.path.toLowerCase().replace(/[./]/g, '\u0000')
  return folders.sort((a, b) => rank(a) - rank(b) || sortKey(a).localeCompare(sortKey(b)))
}

/** The path for a role, creating Archive/Sent when the account has none */
async function rolePath(client: ImapFlow, role: FolderRole, create = false): Promise<string | undefined> {
  if (role === 'inbox') return 'INBOX'
  const list = await client.list()
  const found = toFolders(list).find(f => f.role === role)?.path
  if (found) return found
  if (role === 'archive') {
    const all = list.find(isGmailAll)
    if (all) return all.path
  }
  if (!create) return undefined
  const created = await client.mailboxCreate(role === 'archive' ? 'Archive' : role === 'drafts' ? 'Drafts' : 'Sent')
  return created.path
}

/** A role's folder path, outside a connection of its own */
export function rolePathFor(account: AccountSettings, role: FolderRole): Promise<string | undefined> {
  return withImap(account, client => rolePath(client, role))
}

/* ------------------------------------------------------------------ */
/* Previews                                                            */
/* ------------------------------------------------------------------ */

interface TextPart { key: string, encoding?: string, charset?: string, html: boolean }

function findTextPart(node: MessageStructureObject): TextPart | undefined {
  let html: TextPart | undefined
  const walk = (n: MessageStructureObject): TextPart | undefined => {
    if (n.disposition === 'attachment') return undefined
    if (n.childNodes?.length) {
      for (const child of n.childNodes) {
        const found = walk(child)
        if (found) return found
      }
      return undefined
    }
    const part = { key: n.part ?? '1', encoding: n.encoding, charset: n.parameters?.charset, html: n.type === 'text/html' }
    if (n.type === 'text/plain') return part
    if (part.html) html ??= part
    return undefined
  }
  return walk(node) ?? html
}

function hasAttachment(node?: MessageStructureObject): boolean {
  if (!node) return false
  return node.disposition === 'attachment' || Boolean(node.childNodes?.some(hasAttachment))
}

function decodePart(raw: Buffer, part: TextPart): string {
  let bytes = raw
  const encoding = part.encoding?.toLowerCase()
  if (encoding === 'base64') {
    const clean = raw.toString('latin1').replace(/[^A-Za-z0-9+/]/g, '')
    bytes = Buffer.from(clean.slice(0, clean.length - (clean.length % 4)), 'base64')
  } else if (encoding === 'quoted-printable') {
    const text = raw.toString('latin1').replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    bytes = Buffer.from(text, 'latin1')
  }
  let text: string
  try {
    text = new TextDecoder(part.charset || 'utf-8').decode(bytes)
  } catch {
    text = bytes.toString('utf8')
  }
  return part.html ? htmlToText(text.replace(/<[^>]*$/, '')) : text
}

/** One partial FETCH per distinct part number (usually 1 or 1.1), not one per message */
export async function previews(client: ImapFlow, messages: FetchMessageObject[]): Promise<Map<number, string>> {
  const groups = new Map<string, { uids: number[], parts: Map<number, TextPart> }>()
  for (const msg of messages) {
    const part = msg.bodyStructure && findTextPart(msg.bodyStructure)
    if (!part) continue
    const group = groups.get(part.key) ?? { uids: [] as number[], parts: new Map<number, TextPart>() }
    group.uids.push(msg.uid)
    group.parts.set(msg.uid, part)
    groups.set(part.key, group)
  }

  const result = new Map<number, string>()
  for (const [key, group] of groups) {
    const fetched = await client.fetchAll(group.uids.join(','), { uid: true, bodyParts: [{ key, maxLength: PREVIEW_BYTES }] }, { uid: true })
    for (const msg of fetched) {
      const raw = msg.bodyParts?.get(key) ?? msg.bodyParts?.values().next().value
      const part = group.parts.get(msg.uid)
      if (raw && part) result.set(msg.uid, makePreview(decodePart(raw, part)))
    }
  }
  return result
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

function isoDate(value?: Date | string) {
  const date = value ? new Date(value) : new Date(NaN)
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString()
}

export function toSummary(msg: FetchMessageObject, folder: string, preview: string): MessageSummary {
  const env = msg.envelope ?? {}
  const addr = (a: { name?: string, address?: string }) => ({ name: a.name || undefined, address: a.address ?? '' })
  return {
    id: String(msg.uid),
    folder,
    subject: env.subject ?? '',
    from: env.from?.[0] ? addr(env.from[0]) : { address: '' },
    to: (env.to ?? []).map(addr),
    // The time it was received, as the list is ordered by (mail-order.ts)
    date: isoDate(new Date(sortTime(env.date, msg.internalDate) || Date.now())),
    preview,
    unread: !msg.flags?.has('\\Seen'),
    flagged: Boolean(msg.flags?.has('\\Flagged')),
    hasAttachments: hasAttachment(msg.bodyStructure),
    messageId: env.messageId || undefined
  }
}

/** `before` is the cursor of the previous page: a UID for IMAP, a UIDL for POP3 */
export interface ListQuery extends MailFilters { before?: string, q?: string, unread?: boolean, flagged?: boolean }

const WITHIN_DAYS: Record<DateWithin, number> = { week: 7, month: 31, year: 365 }

async function pageUids(client: ImapFlow, account: AccountSettings, { before: cursor, q, unread, flagged, from, within, on, attachments }: ListQuery) {
  const exists = client.mailbox ? client.mailbox.exists : 0
  if (!exists) return { uids: [], total: 0, cursor: undefined }
  const times = await folderTimes(client, accountKey(account))
  const filtered = Boolean(q || unread || flagged || from || within || on || attachments)
  if (!filtered) return { ...orderPage([...times.keys()], times, cursor, PAGE), total: exists }

  const criteria: SearchObject = {}
  if (unread) criteria.seen = false
  if (flagged) criteria.flagged = true
  if (from) criteria.from = from
  if (within) criteria.since = new Date(Date.now() - WITHIN_DAYS[within] * 86_400_000)
  // By the Date header, the date the reader sees on the message
  if (on) {
    const day = new Date(`${on}T00:00:00Z`)
    criteria.sentSince = day
    criteria.sentBefore = new Date(day.getTime() + 86_400_000)
  }
  // IMAP can't search for attachments; mail with one is almost always multipart/mixed
  if (attachments) criteria.header = { 'content-type': 'multipart/mixed' }
  if (q) criteria.or = [{ subject: q }, { from: q }, { body: q }]
  // Some servers reject OR/FROM combinations; TEXT (headers + body) is the universal fallback
  const found = await client.search(criteria, { uid: true })
    || (q ? await client.search({ ...criteria, or: undefined, text: q }, { uid: true }) : false)
  const all = found || []
  return { ...orderPage(all, times, cursor, PAGE), total: all.length }
}

/**
 * A message never changes once it's in a folder; only its flags do. So each
 * summary (sender, subject, preview) is fetched once and kept, and a page
 * asks the server only for the flags of messages it already knows. On a
 * slow server that's one small request instead of envelopes and previews
 */
const summaries = new Map<string, MessageSummary>()
const MAX_SUMMARIES = 20_000

async function pageSummaries(client: ImapFlow, account: AccountSettings, folder: string, uids: number[]): Promise<MessageSummary[]> {
  const prefix = `${accountKey(account)}\0${folder}\0${client.mailbox ? client.mailbox.uidValidity : ''}\0`
  const missing = uids.filter(uid => !summaries.has(prefix + uid))
  const known = uids.filter(uid => summaries.has(prefix + uid))

  let fetched: FetchMessageObject[] = []
  if (missing.length) {
    fetched = await client.fetchAll(missing.join(','), { uid: true, flags: true, envelope: true, bodyStructure: true, internalDate: true }, { uid: true })
    const texts = await previews(client, fetched)
    for (const msg of fetched) summaries.set(prefix + msg.uid, toSummary(msg, folder, texts.get(msg.uid) ?? ''))
  }
  const flags = new Map<number, Set<string>>()
  if (known.length) {
    for (const msg of await client.fetchAll(known.join(','), { uid: true, flags: true }, { uid: true })) flags.set(msg.uid, msg.flags ?? new Set())
  }
  for (const msg of fetched) flags.set(msg.uid, msg.flags ?? new Set())
  while (summaries.size > MAX_SUMMARIES) summaries.delete(summaries.keys().next().value!)

  // A UID the server no longer answers for is gone (deleted or moved,
  // maybe from another device). Showing its saved summary would list a
  // message that can't be opened
  const gone = uids.filter(uid => !flags.has(uid))
  if (gone.length) {
    for (const uid of gone) summaries.delete(prefix + uid)
    forgetUids(client, accountKey(account), gone)
  }

  return uids.flatMap((uid) => {
    const summary = summaries.get(prefix + uid)
    const current = flags.get(uid)
    if (!summary || !current) return []
    return [{ ...summary, unread: !current.has('\\Seen'), flagged: current.has('\\Flagged') }]
  })
}

/** Messages are read whole into memory, so a server can't hand us an endless one */
const MAX_MESSAGE_BYTES = 64 * 1024 * 1024

async function assertOpenable(client: ImapFlow, id: string) {
  const info = await client.fetchOne(id, { uid: true, size: true }, { uid: true })
  if (info && (info.size ?? 0) > MAX_MESSAGE_BYTES) {
    throw createError({ status: 413, message: 'This message is too large to open here.' })
  }
}

export const imapBackend = {
  listFolders(account: AccountSettings): Promise<Folder[]> {
    return withImap(account, async client => toFolders(await client.list({ statusQuery: { unseen: true } })))
  },

  listMessages(account: AccountSettings, folder: string, query: ListQuery): Promise<MessagePage> {
    return withMailbox(account, folder, async (client) => {
      // The folder stays selected on this connection between requests, and
      // without IDLE it only hears about deletions when it sends a command.
      // NOOP collects them, so the count the folder index trusts is current
      await client.noop().catch(() => {})
      const page = await pageUids(client, account, query)
      if (!page.uids.length) return { messages: [], total: page.total }
      const messages = await pageSummaries(client, account, folder, page.uids)
      return { messages, total: page.total, cursor: page.cursor }
    })
  },

  async getMessage(account: AccountSettings, folder: string, id: string, allowRemote: RemotePolicy): Promise<MessageDetail> {
    const msg = await withMailbox(account, folder, async (client) => {
      await assertOpenable(client, id)
      const found = await client.fetchOne(id, { uid: true, flags: true, source: true }, { uid: true })
      if (found && !found.flags?.has('\\Seen')) await client.messageFlagsAdd(id, ['\\Seen'], { uid: true })
      return found
    })
    if (!msg || !msg.source) throw createError({ status: 404, message: 'This message no longer exists.' })
    const parsed = await simpleParser(msg.source, { skipImageLinks: true })
    return toMessageDetail(parsed, { id, folder, unread: false, flagged: Boolean(msg.flags?.has('\\Flagged')) }, allowRemote)
  },

  async getSource(account: AccountSettings, folder: string, id: string): Promise<Buffer> {
    const msg = await withMailbox(account, folder, async (client) => {
      await assertOpenable(client, id)
      return client.fetchOne(id, { uid: true, source: true }, { uid: true })
    })
    if (!msg || !msg.source) throw createError({ status: 404, message: 'This message no longer exists.' })
    return msg.source
  },

  setFlags(account: AccountSettings, folder: string, id: string, flags: { unread?: boolean, flagged?: boolean }): Promise<void> {
    return withMailbox(account, folder, async (client) => {
      const change = (flag: string, on?: boolean) => on === undefined
        ? undefined
        : on ? client.messageFlagsAdd(id, [flag], { uid: true }) : client.messageFlagsRemove(id, [flag], { uid: true })
      await change('\\Seen', flags.unread === undefined ? undefined : !flags.unread)
      await change('\\Flagged', flags.flagged)
    })
  },

  async move(account: AccountSettings, folder: string, id: string, to: string): Promise<void> {
    const destination = ['inbox', 'archive', 'trash', 'junk'].includes(to)
      ? await withImap(account, client => rolePath(client, to as FolderRole, to === 'archive'))
      : to
    if (!destination) throw createError({ status: 400, message: `This account has no ${to} folder.` })
    if (destination === folder) return
    await withMailbox(account, folder, async (client) => {
      await client.messageMove(id, destination, { uid: true })
      forgetUids(client, accountKey(account), [Number(id)])
    })
  },

  async remove(account: AccountSettings, folder: string, id: string): Promise<void> {
    const trash = await withImap(account, client => rolePath(client, 'trash'))
    await withMailbox(account, folder, async (client) => {
      if (trash && trash !== folder) await client.messageMove(id, trash, { uid: true })
      else await client.messageDelete(id, { uid: true })
      forgetUids(client, accountKey(account), [Number(id)])
    })
  },

  async createFolder(account: AccountSettings, name: string, parent?: string): Promise<string> {
    return withImap(account, async (client) => {
      const list = await client.list()
      const delimiter = list.find(entry => entry.path === parent)?.delimiter ?? list[0]?.delimiter ?? '/'
      const path = parent ? `${parent}${delimiter}${name}` : name
      if (list.some(entry => entry.path.toLowerCase() === path.toLowerCase())) {
        throw createError({ status: 409, message: `There's already a folder called “${name}”.` })
      }
      const created = await client.mailboxCreate(path)
      await client.mailboxSubscribe(created.path).catch(() => {})
      return created.path
    })
  },

  async renameFolder(account: AccountSettings, path: string, name: string): Promise<string> {
    return withImap(account, async (client) => {
      const list = await client.list()
      const entry = list.find(item => item.path === path)
      if (!entry) throw createError({ status: 404, message: 'That folder doesn\'t exist.' })
      if (toFolders([entry])[0]?.role) throw createError({ status: 400, message: `${entry.name} can't be renamed.` })
      const parent = entry.delimiter && path.includes(entry.delimiter) ? path.slice(0, path.lastIndexOf(entry.delimiter) + 1) : ''
      if (list.some(item => item.path.toLowerCase() === `${parent}${name}`.toLowerCase() && item.path !== path)) {
        throw createError({ status: 409, message: `There's already a folder called “${name}”.` })
      }
      const renamed = await client.mailboxRename(path, `${parent}${name}`)
      await client.mailboxSubscribe(renamed.newPath).catch(() => {})
      return renamed.newPath
    })
  },

  /**
   * Removes a folder, never the mail in it: its messages, and those of any
   * folder inside it, go back to the Inbox first. Returns how many moved
   */
  async deleteFolder(account: AccountSettings, path: string): Promise<number> {
    const list = await withImap(account, client => client.list())
    const entry = list.find(item => item.path === path)
    if (!entry) return 0
    if (toFolders([entry])[0]?.role) throw createError({ status: 400, message: `${entry.name} can't be deleted.` })

    // Deepest first, so a parent is empty of folders by the time it goes
    const inside = list
      .filter(item => item.path === path || (entry.delimiter && item.path.startsWith(`${path}${entry.delimiter}`)))
      .sort((a, b) => b.path.length - a.path.length)

    let moved = 0
    for (const folder of inside) {
      if (!folder.flags.has('\\Noselect')) {
        moved += await withMailbox(account, folder.path, async (client) => {
          const count = client.mailbox ? client.mailbox.exists : 0
          if (count) await client.messageMove('1:*', 'INBOX')
          return count
        })
      }
      await withImap(account, client => client.mailboxDelete(folder.path))
    }
    return moved
  },

  /** Saves a draft, replacing the copy saved before it */
  async saveDraft(account: AccountSettings, raw: Buffer, replace?: DraftRef): Promise<DraftRef> {
    const saved = await withImap(account, async (client) => {
      const drafts = await rolePath(client, 'drafts', true)
      if (!drafts) throw createError({ status: 400, message: 'This account has no Drafts folder.' })
      const result = await client.append(drafts, raw, ['\\Draft', '\\Seen'])
      return { folder: drafts, id: result && result.uid ? String(result.uid) : '' }
    })
    if (replace) await this.discardDraft(account, replace).catch(() => {})
    return saved
  },

  async discardDraft(account: AccountSettings, draft: DraftRef): Promise<void> {
    if (!/^\d{1,10}$/.test(draft.id)) return
    await withMailbox(account, draft.folder, client => client.messageDelete(draft.id, { uid: true }))
  },

  /**
   * One search across every folder but Trash and Junk, newest first. Used by
   * AI search, which turns a question into these criteria
   */
  async searchAll(account: AccountSettings, criteria: SearchObject, limit = 40): Promise<MessageSummary[]> {
    const folders = await this.listFolders(account)
    const searchable = folders.filter(folder => folder.role !== 'trash' && folder.role !== 'junk')
    const found: MessageSummary[] = []
    for (const folder of searchable) {
      const summaries = await withMailbox(account, folder.path, async (client) => {
        if (!client.mailbox || !client.mailbox.exists) return []
        const uids = await client.search(criteria, { uid: true }).catch(() => false)
        if (!Array.isArray(uids) || !uids.length) return []
        const newest = uids.sort((a, b) => b - a).slice(0, limit)
        const fetched = await client.fetchAll(newest.join(','), { uid: true, flags: true, envelope: true, bodyStructure: true, internalDate: true }, { uid: true })
        const texts = await previews(client, fetched)
        return fetched.map(msg => toSummary(msg, folder.path, texts.get(msg.uid) ?? ''))
      }).catch(() => [] as MessageSummary[])
      found.push(...summaries)
    }
    return found.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
  },

  async appendSent(account: AccountSettings, raw: Buffer): Promise<void> {
    // Gmail files sent mail itself; appending would make a duplicate
    if (/(^|\.)(gmail|googlemail)\.com$/i.test(account.incoming.host)) return
    await withImap(account, async (client) => {
      const sent = await rolePath(client, 'sent', true)
      if (sent) await client.append(sent, raw, ['\\Seen'])
    })
  }
}
