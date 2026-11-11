import { createHash } from 'node:crypto'

/**
 * A small JMAP client (RFC 8620 core, RFC 8621 mail): the session, method
 * calls, blob upload and download, and the pure mapping between JMAP
 * objects and CitrusMail's. Nothing here reaches Nuxt or the network on its
 * own: the caller passes the fetch to use (net-guard's guardedFetch in the
 * app, a mock in the tests). mail-jmap.ts builds the mail backend on top.
 */

export const JMAP_CORE = 'urn:ietf:params:jmap:core'
export const JMAP_MAIL = 'urn:ietf:params:jmap:mail'
export const JMAP_SUBMISSION = 'urn:ietf:params:jmap:submission'

/** JMAP ids are opaque strings from the URL-safe base64 alphabet (RFC 8620 §1.2) */
export const JMAP_ID = /^[A-Za-z0-9_-]{1,255}$/

const MAX_JSON_BYTES = 32 * 1024 * 1024
/** Messages are read whole into memory, so a server can't hand us an endless one */
export const JMAP_MAX_BLOB = 64 * 1024 * 1024
const SESSION_TTL = 5 * 60_000

export interface JmapSession {
  apiUrl: string
  downloadUrl: string
  uploadUrl: string
  /** The primary account for mail */
  accountId: string
  /** The server can send mail itself (EmailSubmission) */
  submission: boolean
  state?: string
}

export interface JmapContext {
  account: AccountSettings
  fetch: typeof fetch
}

export type JmapCall = [name: string, args: Record<string, unknown>, callId: string]

/** Carries the same fields describeMailError() looks at for IMAP errors */
export class JmapError extends Error {
  type?: string
  authenticationFailed?: boolean
  responseText?: string
  constructor(message: string, type?: string, authenticationFailed?: boolean) {
    super(message)
    this.type = type
    this.authenticationFailed = authenticationFailed
    this.responseText = message
  }
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

/** The session URL: the one given, or /.well-known/jmap on the incoming host */
export function jmapSessionUrl(incoming: AccountSettings['incoming']): string {
  if (incoming.url) return incoming.url
  const scheme = incoming.security === 'none' ? 'http' : 'https'
  const host = incoming.host.includes(':') && !incoming.host.startsWith('[') ? `[${incoming.host}]` : incoming.host
  const port = incoming.port && incoming.port !== (scheme === 'https' ? 443 : 80) ? `:${incoming.port}` : ''
  return `${scheme}://${host}${port}/.well-known/jmap`
}

/**
 * JMAP settings whose host, port and security are the session URL's. With a
 * URL, the host is never contacted, so a host typed alongside it would be a
 * label anyone could choose; and the host is what an account's stored data is
 * filed under (store.ts). An unparsable URL is left for sign-in to refuse
 */
export function jmapBoundIncoming(incoming: AccountSettings['incoming']): AccountSettings['incoming'] {
  if (incoming.protocol !== 'jmap' || !incoming.url) return incoming
  let url: URL
  try {
    url = new URL(incoming.url)
  } catch {
    return incoming
  }
  const secure = url.protocol === 'https:'
  return {
    ...incoming,
    host: url.hostname.replace(/^\[|\]$/g, ''),
    port: Number(url.port) || (secure ? 443 : 80),
    security: secure ? 'tls' : 'none'
  }
}

/** Basic with the login and (app) password, or the password as a bearer token */
export function jmapAuthHeader(account: AccountSettings): string {
  if (account.incoming.auth === 'bearer') return `Bearer ${account.password}`
  return `Basic ${Buffer.from(`${account.username || account.email}:${account.password}`, 'utf8').toString('base64')}`
}

/** Reads the session object; its URLs may be relative to where it was found */
export function parseJmapSession(json: unknown, base: string): JmapSession {
  const raw = (json ?? {}) as {
    apiUrl?: string
    downloadUrl?: string
    uploadUrl?: string
    state?: string
    capabilities?: Record<string, unknown>
    primaryAccounts?: Record<string, string>
    accounts?: Record<string, { accountCapabilities?: Record<string, unknown> }>
  }
  const accountId = raw.primaryAccounts?.[JMAP_MAIL]
  if (!raw.capabilities?.[JMAP_MAIL] || !accountId || !raw.apiUrl || !raw.downloadUrl || !raw.uploadUrl) {
    throw new JmapError('This server doesn\'t offer mail over JMAP.')
  }
  // The password goes to these URLs, so an https session never points at plain http
  const secure = new URL(base).protocol === 'https:'
  // Templates keep their {braces}: only the scheme and host are resolved
  const resolve = (url: string) => {
    const absolute = /^https?:\/\//i.test(url) ? url : new URL(url, base).origin + (url.startsWith('/') ? url : `/${url}`)
    if (secure && !absolute.toLowerCase().startsWith('https://')) throw new JmapError('The JMAP server named an insecure URL.')
    return absolute
  }
  const capabilities = raw.accounts?.[accountId]?.accountCapabilities ?? {}
  return {
    apiUrl: resolve(raw.apiUrl),
    downloadUrl: resolve(raw.downloadUrl),
    uploadUrl: resolve(raw.uploadUrl),
    accountId,
    submission: Boolean(raw.capabilities[JMAP_SUBMISSION] && capabilities[JMAP_SUBMISSION]),
    state: raw.state
  }
}

const sessions = new Map<string, { at: number, session: JmapSession }>()

/** One key per server and credentials, for what's cached about an account */
export function jmapAccountKey(account: AccountSettings) {
  return cacheKey(account)
}

function cacheKey(account: AccountSettings) {
  return createHash('sha256').update([jmapSessionUrl(account.incoming), jmapAuthHeader(account)].join('\0')).digest('hex')
}

async function readJson(res: Response): Promise<unknown> {
  const length = Number(res.headers.get('content-length') ?? 0)
  if (length > MAX_JSON_BYTES) {
    await res.body?.cancel()
    throw new JmapError('The JMAP server sent a response too large to read.')
  }
  const text = await res.text()
  if (text.length > MAX_JSON_BYTES) throw new JmapError('The JMAP server sent a response too large to read.')
  try {
    return JSON.parse(text)
  } catch {
    throw new JmapError('The server didn\'t answer like a JMAP server.')
  }
}

async function failure(res: Response): Promise<JmapError> {
  if (res.status === 401 || res.status === 403) {
    await res.body?.cancel()
    return new JmapError('Authentication failed', 'unauthorized', true)
  }
  // Request-level errors are RFC 7807 problem details
  const problem = await readJson(res).catch(() => undefined) as { type?: string, detail?: string } | undefined
  const type = problem?.type?.replace('urn:ietf:params:jmap:error:', '')
  return new JmapError(problem?.detail || `HTTP ${res.status}`, type)
}

/**
 * Fetches the session, following redirects (/.well-known/jmap usually
 * redirects) only on the same host, so the password never follows a redirect
 * somewhere else
 */
export async function jmapSession(ctx: JmapContext, fresh = false): Promise<JmapSession> {
  const key = cacheKey(ctx.account)
  const hit = sessions.get(key)
  if (!fresh && hit && Date.now() - hit.at < SESSION_TTL) return hit.session

  const start = new URL(jmapSessionUrl(ctx.account.incoming))
  let url = start
  for (let hop = 0; hop < 5; hop++) {
    const res = await ctx.fetch(url, { headers: { Authorization: jmapAuthHeader(ctx.account), Accept: 'application/json' }, redirect: 'manual' })
    const location = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel()
      const next = new URL(location, url)
      if (next.hostname !== start.hostname || (start.protocol === 'https:' && next.protocol !== 'https:')) {
        throw new JmapError(`The JMAP session moved to another host (${next.hostname}). Enter that session URL instead.`)
      }
      url = next
      continue
    }
    if (!res.ok) throw await failure(res)
    const session = parseJmapSession(await readJson(res), url.toString())
    sessions.set(key, { at: Date.now(), session })
    if (sessions.size > 500) sessions.delete(sessions.keys().next().value!)
    return session
  }
  throw new JmapError('Too many redirects finding the JMAP session.')
}

/**
 * Signs in without asking how: the secret as a password (Basic), then as an
 * API token (Bearer, as Fastmail wants), and makes one call to the API URL
 * the session names, so a broken session fails here and not later. Returns
 * the way that worked, to be kept with the account
 */
export async function jmapSignIn(account: AccountSettings, fetch: typeof globalThis.fetch): Promise<{ auth: 'basic' | 'bearer', session: JmapSession }> {
  // A token is printable ASCII; anything else can't go in a Bearer header
  const tokenLike = /^[\x21-\x7E]+$/.test(account.password)
  const tries = account.incoming.auth ? [account.incoming.auth] : tokenLike ? ['basic', 'bearer'] as const : ['basic'] as const
  let failure: unknown
  for (const auth of tries) {
    const ctx: JmapContext = { account: { ...account, incoming: { ...account.incoming, auth } }, fetch }
    try {
      const session = await jmapSession(ctx, true)
      await jmapRequest(ctx, [['Core/echo', {}, '0']])
      return { auth, session }
    } catch (error) {
      failure = error
      if (!(error instanceof JmapError && error.authenticationFailed)) throw error
    }
  }
  throw failure
}

export function forgetJmapSession(account: AccountSettings) {
  sessions.delete(cacheKey(account))
}

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

export type JmapResponses = Map<string, Record<string, unknown>>

/** The request body: core and mail, plus submission when the server has it */
export function jmapRequestBody(session: JmapSession, calls: JmapCall[]) {
  return {
    using: [JMAP_CORE, JMAP_MAIL, ...(session.submission ? [JMAP_SUBMISSION] : [])],
    methodCalls: calls
  }
}

/** Responses by call id; a method error throws, naming its JMAP type */
export function readJmapResponses(json: unknown): JmapResponses {
  const list = (json as { methodResponses?: unknown })?.methodResponses
  if (!Array.isArray(list)) throw new JmapError('The server didn\'t answer like a JMAP server.')
  const responses: JmapResponses = new Map()
  for (const entry of list) {
    const [name, args, id] = entry as [string, Record<string, unknown>, string]
    if (name === 'error') {
      const type = String(args?.type ?? 'serverFail')
      throw new JmapError(args?.description ? `${type}: ${String(args.description)}` : type, type)
    }
    // A /get with #ids answers under the same call id as its query; keep the first
    if (!responses.has(id)) responses.set(id, args ?? {})
  }
  return responses
}

/** One round trip with any number of method calls */
export async function jmapRequest(ctx: JmapContext, calls: JmapCall[]): Promise<JmapResponses> {
  const session = await jmapSession(ctx)
  const res = await ctx.fetch(session.apiUrl, {
    method: 'POST',
    headers: { 'Authorization': jmapAuthHeader(ctx.account), 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(jmapRequestBody(session, calls))
  })
  if (!res.ok) {
    forgetJmapSession(ctx.account)
    throw await failure(res)
  }
  const json = await readJson(res) as { sessionState?: string }
  // The session changed (new account, capabilities): fetch it again next time
  if (session.state && json.sessionState && json.sessionState !== session.state) forgetJmapSession(ctx.account)
  return readJmapResponses(json)
}

/** A /set call's result for one record, or its SetError as a JmapError */
export function jmapSetResult(response: Record<string, unknown> | undefined, kind: 'created' | 'updated' | 'destroyed', id: string): Record<string, unknown> {
  const failed = response?.[`not${kind[0]!.toUpperCase()}${kind.slice(1)}`] as Record<string, { type?: string, description?: string }> | undefined
  const error = failed?.[id]
  if (error) throw new JmapError(error.description || error.type || 'The server refused the change.', error.type)
  if (kind === 'destroyed') return {}
  return (response?.[kind] as Record<string, Record<string, unknown> | null> | undefined)?.[id] ?? {}
}

export function fillJmapTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => name in values ? encodeURIComponent(values[name]!) : match)
}

export async function jmapUpload(ctx: JmapContext, data: Buffer, type = 'message/rfc822'): Promise<string> {
  const session = await jmapSession(ctx)
  const res = await ctx.fetch(fillJmapTemplate(session.uploadUrl, { accountId: session.accountId }), {
    method: 'POST',
    headers: { 'Authorization': jmapAuthHeader(ctx.account), 'Content-Type': type },
    body: new Uint8Array(data)
  })
  if (!res.ok) throw await failure(res)
  const blobId = (await readJson(res) as { blobId?: string }).blobId
  if (!blobId) throw new JmapError('The JMAP server didn\'t accept the upload.')
  return blobId
}

export async function jmapDownload(ctx: JmapContext, blobId: string, name = 'message.eml', type = 'message/rfc822'): Promise<Buffer> {
  const session = await jmapSession(ctx)
  const res = await ctx.fetch(fillJmapTemplate(session.downloadUrl, { accountId: session.accountId, blobId, name, type }), {
    headers: { Authorization: jmapAuthHeader(ctx.account) }
  })
  if (!res.ok) throw await failure(res)
  if (Number(res.headers.get('content-length') ?? 0) > JMAP_MAX_BLOB) {
    await res.body?.cancel()
    throw Object.assign(new JmapError('This message is too large to open here.'), { code: 'ETOOBIG' })
  }
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.length > JMAP_MAX_BLOB) throw Object.assign(new JmapError('This message is too large to open here.'), { code: 'ETOOBIG' })
  return bytes
}

/* ------------------------------------------------------------------ */
/* Mailboxes                                                           */
/* ------------------------------------------------------------------ */

export interface JmapMailbox {
  id: string
  name: string
  parentId?: string | null
  role?: string | null
  sortOrder?: number
  unreadEmails?: number
}

const ROLES: Record<string, FolderRole> = {
  inbox: 'inbox', sent: 'sent', drafts: 'drafts', trash: 'trash', junk: 'junk', archive: 'archive'
}
const ORDER: FolderRole[] = ['inbox', 'drafts', 'sent', 'archive', 'junk', 'trash']

/** The Inbox keeps the path INBOX, as on IMAP and POP3; every other folder is its mailbox id */
export const JMAP_INBOX = 'INBOX'

/** Where settings live in the mailbox, never shown as a folder: the same name as IMAP's SYNC_FOLDER (mail-imap.ts) */
export const JMAP_SYNC_FOLDER = 'CitrusMail Settings'

export function isJmapSyncFolder(mailbox: JmapMailbox): boolean {
  return !mailbox.parentId && mailbox.name === JMAP_SYNC_FOLDER
}

export function jmapFolderPath(mailbox: JmapMailbox): string {
  return mailbox.role === 'inbox' ? JMAP_INBOX : mailbox.id
}

/** The mailbox behind a folder path, or undefined */
export function findJmapMailbox(mailboxes: JmapMailbox[], path: string): JmapMailbox | undefined {
  return path === JMAP_INBOX ? mailboxes.find(m => m.role === 'inbox') : mailboxes.find(m => m.id === path)
}

export function findJmapRole(mailboxes: JmapMailbox[], role: FolderRole): JmapMailbox | undefined {
  return mailboxes.find(m => m.role === role)
}

/** A mailbox and every mailbox inside it, deepest first */
export function jmapMailboxTree(mailboxes: JmapMailbox[], id: string): JmapMailbox[] {
  const depth = (m: JmapMailbox): number => m.parentId ? 1 + depth(mailboxes.find(p => p.id === m.parentId) ?? { id: '', name: '' }) : 0
  const inside = (m: JmapMailbox): boolean => m.id === id || Boolean(m.parentId && inside(mailboxes.find(p => p.id === m.parentId) ?? { id: '', name: '' }))
  return mailboxes.filter(inside).sort((a, b) => depth(b) - depth(a))
}

export function jmapFolders(all: JmapMailbox[]): Folder[] {
  const mailboxes = all.filter(m => !isJmapSyncFolder(m))
  const byId = new Map(mailboxes.map(m => [m.id, m]))
  const ancestors = (m: JmapMailbox) => {
    const chain: JmapMailbox[] = []
    let parent = m.parentId ? byId.get(m.parentId) : undefined
    while (parent && chain.length < 50) {
      chain.unshift(parent)
      parent = parent.parentId ? byId.get(parent.parentId) : undefined
    }
    return chain
  }
  const folders = mailboxes.map((m) => {
    const role = m.role ? ROLES[m.role] : undefined
    const chain = ancestors(m)
    return {
      folder: {
        path: jmapFolderPath(m),
        name: role === 'inbox' ? 'Inbox' : m.name,
        role,
        unread: m.unreadEmails ?? 0,
        depth: role ? 0 : chain.length,
        fullName: m.role === 'inbox' ? JMAP_INBOX : [...chain, m].map(p => p.name).join('/')
      } as Folder,
      // Tree order: each folder right after its parent, siblings by sortOrder then name
      key: [...chain, m].map(p => `${String(p.sortOrder ?? 0).padStart(10, '0')}${p.name.toLowerCase()}`).join('\u0000')
    }
  })
  const rank = (f: Folder) => (f.role && ORDER.includes(f.role) ? ORDER.indexOf(f.role) : ORDER.length)
  return folders
    .sort((a, b) => rank(a.folder) - rank(b.folder) || a.key.localeCompare(b.key))
    .map(entry => entry.folder)
}

/* ------------------------------------------------------------------ */
/* Emails                                                              */
/* ------------------------------------------------------------------ */

export interface JmapAddress { name?: string | null, email?: string | null }

export interface JmapEmail {
  id: string
  blobId?: string
  mailboxIds?: Record<string, boolean>
  keywords?: Record<string, boolean>
  from?: JmapAddress[] | null
  to?: JmapAddress[] | null
  subject?: string | null
  receivedAt?: string
  size?: number
  preview?: string
  hasAttachment?: boolean
  /** Parts outside the text and HTML bodies, with only the properties asked for */
  attachments?: { disposition?: string | null, name?: string | null }[] | null
  messageId?: string[] | null
}

export const JMAP_SUMMARY_PROPERTIES = ['id', 'blobId', 'mailboxIds', 'keywords', 'from', 'to', 'subject', 'receivedAt', 'size', 'preview', 'hasAttachment', 'attachments', 'messageId']

/** Only what deciding on the paperclip needs from each attachment part */
export const JMAP_ATTACHMENT_PROPERTIES = ['partId', 'disposition', 'name']

/**
 * Whether the paperclip shows. Servers set hasAttachment by their own
 * heuristics (some set it on every message), so the parts decide, as on
 * IMAP: one marked as an attachment, or a named one that isn't inline.
 * hasAttachment is only the fallback for a server that gave no parts
 */
export function jmapHasAttachments(email: JmapEmail): boolean {
  if (!email.attachments) return Boolean(email.hasAttachment)
  return email.attachments.some(part => part.disposition === 'attachment' || (part.disposition !== 'inline' && Boolean(part.name)))
}

const address = (a?: JmapAddress) => ({ name: a?.name || undefined, address: a?.email ?? '' })

export function jmapSummary(email: JmapEmail, folder: string): MessageSummary {
  const date = email.receivedAt ? new Date(email.receivedAt) : new Date(0)
  return {
    id: email.id,
    folder,
    subject: email.subject ?? '',
    from: address(email.from?.[0] ?? undefined),
    to: (email.to ?? []).map(address),
    date: (Number.isNaN(date.getTime()) ? new Date(0) : date).toISOString(),
    preview: (email.preview ?? '').replace(/\s+/g, ' ').trim(),
    unread: !email.keywords?.$seen,
    flagged: Boolean(email.keywords?.$flagged),
    hasAttachments: jmapHasAttachments(email),
    // JMAP gives the id without the angle brackets IMAP's envelope has
    messageId: email.messageId?.[0] ? `<${email.messageId[0]}>` : undefined
  }
}

/** The folder a message found by a search across mailboxes is shown in */
export function jmapFolderOf(email: JmapEmail, mailboxes: JmapMailbox[]): string {
  const ids = Object.keys(email.mailboxIds ?? {}).filter(id => email.mailboxIds![id])
  const mailbox = mailboxes.find(m => m.role === 'inbox' && ids.includes(m.id)) ?? mailboxes.find(m => ids.includes(m.id))
  return mailbox ? jmapFolderPath(mailbox) : (ids[0] ?? JMAP_INBOX)
}

type Filter = Record<string, unknown>

const and = (conditions: Filter[]): Filter => conditions.length === 1 ? conditions[0]! : { operator: 'AND', conditions }

const WITHIN_DAYS: Record<DateWithin, number> = { week: 7, month: 31, year: 365 }

/** The ListQuery the routes pass (see mail-imap.ts), as an Email/query filter */
export function jmapListFilter(mailboxId: string, query: { q?: string, unread?: boolean, flagged?: boolean } & MailFilters, now = Date.now()): Filter {
  const conditions: Filter[] = [{ inMailbox: mailboxId }]
  if (query.unread) conditions.push({ notKeyword: '$seen' })
  if (query.flagged) conditions.push({ hasKeyword: '$flagged' })
  if (query.from) conditions.push({ from: query.from })
  if (query.within) conditions.push({ after: new Date(now - WITHIN_DAYS[query.within] * 86_400_000).toISOString() })
  if (query.on) {
    const day = new Date(`${query.on}T00:00:00Z`)
    conditions.push({ after: day.toISOString(), before: new Date(day.getTime() + 86_400_000).toISOString() })
  }
  if (query.attachments) conditions.push({ hasAttachment: true })
  if (query.q) conditions.push({ text: query.q })
  return and(conditions)
}

/** The subset of imapflow's SearchObject that AI search builds, as a JMAP filter */
export interface SearchLike {
  from?: string
  to?: string
  cc?: string
  subject?: string
  body?: string
  text?: string
  since?: Date | string
  before?: Date | string
  sentSince?: Date | string
  sentBefore?: Date | string
  seen?: boolean
  flagged?: boolean
  header?: Record<string, string | boolean>
  or?: SearchLike[]
}

export function jmapSearchFilter(criteria: SearchLike): Filter {
  const iso = (value: Date | string) => new Date(value).toISOString()
  const conditions: Filter[] = []
  for (const key of ['from', 'to', 'cc', 'subject', 'body', 'text'] as const) {
    if (criteria[key]) conditions.push({ [key]: criteria[key] })
  }
  const after = criteria.since ?? criteria.sentSince
  const before = criteria.before ?? criteria.sentBefore
  if (after) conditions.push({ after: iso(after) })
  if (before) conditions.push({ before: iso(before) })
  if (criteria.seen !== undefined) conditions.push({ [criteria.seen ? 'hasKeyword' : 'notKeyword']: '$seen' })
  if (criteria.flagged !== undefined) conditions.push({ [criteria.flagged ? 'hasKeyword' : 'notKeyword']: '$flagged' })
  // IMAP can't search for attachments, so AI search asks for multipart/mixed; JMAP can
  if (criteria.header?.['content-type'] === 'multipart/mixed') conditions.push({ hasAttachment: true })
  if (criteria.or?.length) conditions.push({ operator: 'OR', conditions: criteria.or.map(jmapSearchFilter) })
  return conditions.length ? and(conditions) : {}
}

/** Email/query and Email/get in one round trip, newest first */
export function jmapQueryCalls(accountId: string, filter: Filter, options: { anchor?: string, limit: number }): JmapCall[] {
  return [
    ['Email/query', {
      accountId,
      filter,
      sort: [{ property: 'receivedAt', isAscending: false }],
      // The cursor is the last id of the page before: start right after it
      ...(options.anchor ? { anchor: options.anchor, anchorOffset: 1 } : {}),
      limit: options.limit,
      calculateTotal: true
    }, 'q'],
    ['Email/get', {
      accountId,
      '#ids': { resultOf: 'q', name: 'Email/query', path: '/ids' },
      'properties': JMAP_SUMMARY_PROPERTIES,
      'bodyProperties': JMAP_ATTACHMENT_PROPERTIES
    }, 'g']
  ]
}

/** The page from jmapQueryCalls' responses, in the query's order. `folder` can be per message, for a search across folders */
export function readJmapPage(responses: JmapResponses, folder: string | ((email: JmapEmail) => string)): MessagePage {
  const query = responses.get('q') as { ids?: string[], position?: number, total?: number }
  const list = (responses.get('g') as { list?: JmapEmail[] })?.list ?? []
  const ids = query?.ids ?? []
  const byId = new Map(list.map(email => [email.id, email]))
  const folderOf = typeof folder === 'string' ? () => folder : folder
  const messages = ids.flatMap((id) => {
    const email = byId.get(id)
    return email ? [jmapSummary(email, folderOf(email))] : []
  })
  const total = query?.total ?? messages.length
  const end = (query?.position ?? 0) + ids.length
  return { messages, total, cursor: ids.length && end < total ? ids.at(-1) : undefined }
}

/** A keywords patch for setFlags: only what was asked to change */
export function jmapFlagPatch(flags: { unread?: boolean, flagged?: boolean }): Record<string, true | null> {
  const patch: Record<string, true | null> = {}
  if (flags.unread !== undefined) patch['keywords/$seen'] = flags.unread ? null : true
  if (flags.flagged !== undefined) patch['keywords/$flagged'] = flags.flagged ? true : null
  return patch
}

/** A mailboxIds patch that takes a message out of one mailbox and puts it in another */
export function jmapMovePatch(from: string, to: string): Record<string, true | null> {
  return { [`mailboxIds/${from}`]: null, [`mailboxIds/${to}`]: true }
}

/** The Identity to send as: the one for this address, a wildcard for its domain, or the first */
export function pickJmapIdentity(identities: { id: string, email: string }[], email: string): string | undefined {
  const address = email.toLowerCase()
  const domain = address.split('@')[1]
  return (identities.find(i => i.email.toLowerCase() === address)
    ?? identities.find(i => i.email.toLowerCase() === `*@${domain}`)
    ?? identities[0])?.id
}

/* ------------------------------------------------------------------ */
/* Rules, sender lists and reports                                     */
/* ------------------------------------------------------------------ */

/**
 * A rule's `after` mark on JMAP: there are no UIDs that grow, so the mark is
 * the time the rule was saved (ms), and only mail received since then counts
 */
export const JMAP_RULE_MARK = 'jmap'

/** A rule as an Email/query filter, without the mailbox; undefined when it has no conditions */
export function jmapRuleFilter(rule: Pick<MailRule, 'conditions' | 'match' | 'after'>): Filter | undefined {
  const parts: Filter[] = rule.conditions
    .filter(condition => condition.value.trim())
    .map(({ field, value }) => ({ [field]: value.trim() }))
  if (!parts.length) return undefined
  const conditions = rule.match === 'any' && parts.length > 1 ? [{ operator: 'OR', conditions: parts }] : parts
  // Marks made over IMAP carry their time in `at`; older JMAP marks only in `uid`
  const at = rule.after?.at ?? (rule.after?.validity === JMAP_RULE_MARK ? rule.after.uid : undefined)
  if (at !== undefined) conditions.push({ after: new Date(at).toISOString() })
  return and(conditions)
}

/** Mail from any of these senders (FROM is a substring match, so @example.com finds the domain) */
export function jmapFromFilter(entries: string[]): Filter | undefined {
  if (!entries.length) return undefined
  return entries.length === 1 ? { from: entries[0] } : { operator: 'OR', conditions: entries.map(from => ({ from })) }
}

/** The Content-Type header asked for with each message, to pick out reports */
export const JMAP_CONTENT_TYPE = 'header:Content-Type'

/**
 * Read receipts (RFC 8098) and delivery reports (RFC 3464), by their
 * Content-Type. Checked here rather than with a header filter in the query,
 * which not every server can search (Stalwart finds nothing)
 */
export function isJmapReport(email: JmapEmail): boolean {
  const type = (email as unknown as Record<string, unknown>)[JMAP_CONTENT_TYPE]
  return typeof type === 'string' && /\b(disposition-notification|delivery-status)\b/i.test(type)
}

/** RFC 3461 xtext: what an ENVID may carry on the MAIL FROM line */
function xtext(value: string) {
  return value.replace(/[^\x21-\x7E]|[+=]/g, char => `+${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`)
}

/**
 * The EmailSubmission envelope. With `dsn`, it asks each recipient's server
 * for a delivery report (RFC 3461), as the SMTP path does for tracked mail
 */
export function jmapEnvelope(from: string, to: string[], dsn?: { id: string }) {
  return {
    mailFrom: { email: from, ...(dsn ? { parameters: { RET: 'HDRS', ENVID: xtext(dsn.id) } } : {}) },
    rcptTo: to.map(email => ({ email, ...(dsn ? { parameters: { NOTIFY: 'SUCCESS,FAILURE' } } : {}) }))
  }
}
