import { createError } from 'nuxt/server'
import { simpleParser } from 'mailparser'
import type { ListQuery } from './mail-imap'
import {
  JMAP_ID, JMAP_INBOX, JMAP_MAX_BLOB, JmapError, findJmapMailbox, findJmapRole, jmapDownload, jmapFlagPatch,
  jmapFolderOf, jmapFolderPath, jmapFolders, jmapListFilter, jmapMailboxTree, jmapMovePatch, jmapQueryCalls,
  jmapRequest, jmapSearchFilter, jmapSession, jmapSetResult, jmapUpload, pickJmapIdentity, readJmapPage
} from './jmap'
import type { JmapCall, JmapContext, JmapEmail, JmapMailbox, SearchLike } from './jmap'

const PAGE = 50
/** Messages moved per request when a folder is emptied before it's deleted */
const BATCH = 250

/**
 * Every request goes through net-guard's fetch, so a JMAP server (or a
 * session object naming URLs) can't point this server at a private address.
 * Network failures come back with the error code describeMailError() expects
 */
function context(account: AccountSettings): JmapContext {
  const guarded = guardedFetch(privateHostsAllowed(), 60_000)
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    try {
      return await guarded(input, init)
    } catch (error) {
      const cause = (error as { cause?: { code?: string } }).cause
      if ((error as Error).name === 'TimeoutError') throw Object.assign(new Error('Timed out'), { code: 'ETIMEDOUT' })
      throw cause?.code ? Object.assign(new Error((error as Error).message), { code: cause.code }) : error
    }
  }) as typeof globalThis.fetch
  return { account, fetch }
}

async function accountId(ctx: JmapContext) {
  return (await jmapSession(ctx)).accountId
}

async function call(ctx: JmapContext, name: string, args: Record<string, unknown>) {
  const responses = await jmapRequest(ctx, [[name, { accountId: await accountId(ctx), ...args }, '0']])
  return responses.get('0') ?? {}
}

async function mailboxes(ctx: JmapContext): Promise<JmapMailbox[]> {
  const result = await call(ctx, 'Mailbox/get', { properties: ['id', 'name', 'parentId', 'role', 'sortOrder', 'unreadEmails'] })
  return (result.list as JmapMailbox[] | undefined) ?? []
}

function mailboxIn(list: JmapMailbox[], path: string): JmapMailbox {
  const found = findJmapMailbox(list, path)
  if (!found) throw createError({ status: 404, message: 'That folder doesn\'t exist.' })
  return found
}

const ROLE_NAMES: Partial<Record<FolderRole, string>> = { archive: 'Archive', drafts: 'Drafts', sent: 'Sent', trash: 'Trash', junk: 'Junk' }

/** A role's mailbox, created (as Archive, Drafts or Sent) when asked and missing */
async function roleMailbox(ctx: JmapContext, role: FolderRole, create = false, list?: JmapMailbox[]): Promise<JmapMailbox | undefined> {
  const found = findJmapRole(list ?? await mailboxes(ctx), role)
  if (found || !create) return found
  const name = ROLE_NAMES[role] ?? role
  // Some servers don't let a client set a role: then it's a plain folder by that name
  for (const extra of [{ role }, {}]) {
    try {
      const result = await call(ctx, 'Mailbox/set', { create: { new: { name, parentId: null, ...extra } } })
      return { id: String(jmapSetResult(result, 'created', 'new').id), name, role }
    } catch (error) {
      if (!(error instanceof JmapError) || !Object.keys(extra).length) throw error
    }
  }
}

async function getEmail(ctx: JmapContext, id: string, properties: string[]): Promise<JmapEmail> {
  const result = await call(ctx, 'Email/get', { ids: [id], properties })
  const email = (result.list as JmapEmail[] | undefined)?.[0]
  if (!email) throw createError({ status: 404, message: 'This message no longer exists.' })
  return email
}

async function source(ctx: JmapContext, email: JmapEmail): Promise<Buffer> {
  if ((email.size ?? 0) > JMAP_MAX_BLOB) throw createError({ status: 413, message: 'This message is too large to open here.' })
  if (!email.blobId) throw createError({ status: 404, message: 'This message no longer exists.' })
  return jmapDownload(ctx, email.blobId)
}

async function updateEmails(ctx: JmapContext, update: Record<string, Record<string, unknown>>) {
  const result = await call(ctx, 'Email/set', { update })
  for (const id of Object.keys(update)) jmapSetResult(result, 'updated', id)
}

async function destroyEmail(ctx: JmapContext, id: string) {
  jmapSetResult(await call(ctx, 'Email/set', { destroy: [id] }), 'destroyed', id)
}

/** Uploads a message and files it in one mailbox, returning its new id */
async function importEmail(ctx: JmapContext, raw: Buffer, mailboxId: string, keywords: Record<string, true>): Promise<string> {
  const blobId = await jmapUpload(ctx, raw)
  const result = await call(ctx, 'Email/import', { emails: { new: { blobId, mailboxIds: { [mailboxId]: true }, keywords } } })
  return String(jmapSetResult(result, 'created', 'new').id)
}

function sameName(list: JmapMailbox[], parentId: string | null, name: string, except?: string) {
  return list.some(m => (m.parentId ?? null) === parentId && m.name.toLowerCase() === name.toLowerCase() && m.id !== except)
}

/**
 * Checks the session, the password and that the API URL the session names
 * answers (Core/echo costs nothing); used before a session cookie is made
 */
export async function verifyJmap(account: AccountSettings): Promise<{ submission: boolean }> {
  const ctx = context(account)
  const session = await jmapSession(ctx, true)
  await jmapRequest(ctx, [['Core/echo', {}, '0']])
  return { submission: session.submission }
}

/** Whether this account sends through the JMAP server instead of SMTP */
export async function jmapCanSubmit(account: AccountSettings): Promise<boolean> {
  return (await jmapSession(context(account))).submission
}

export const jmapBackend = {
  async listFolders(account: AccountSettings): Promise<Folder[]> {
    return jmapFolders(await mailboxes(context(account)))
  },

  async listMessages(account: AccountSettings, folder: string, query: ListQuery): Promise<MessagePage> {
    const ctx = context(account)
    // A folder's path is its mailbox id, so only the Inbox needs looking up
    const mailboxId = folder === JMAP_INBOX ? mailboxIn(await mailboxes(ctx), folder).id : folder
    if (!JMAP_ID.test(mailboxId)) throw createError({ status: 404, message: 'That folder doesn\'t exist.' })
    const anchor = query.before && JMAP_ID.test(query.before) ? query.before : undefined
    try {
      const calls = jmapQueryCalls(await accountId(ctx), jmapListFilter(mailboxId, query), { anchor, limit: PAGE })
      return readJmapPage(await jmapRequest(ctx, calls), folder)
    } catch (error) {
      // The message the page started after is gone: nothing more to show from there
      if (error instanceof JmapError && error.type === 'anchorNotFound') return { messages: [], total: 0 }
      throw error
    }
  },

  async getMessage(account: AccountSettings, folder: string, id: string, allowRemote: RemotePolicy): Promise<MessageDetail> {
    const ctx = context(account)
    const email = await getEmail(ctx, id, ['id', 'blobId', 'size', 'keywords'])
    const raw = await source(ctx, email)
    if (!email.keywords?.$seen) await updateEmails(ctx, { [id]: jmapFlagPatch({ unread: false }) }).catch(() => {})
    const parsed = await simpleParser(raw, { skipImageLinks: true })
    return toMessageDetail(parsed, { id, folder, unread: false, flagged: Boolean(email.keywords?.$flagged) }, allowRemote)
  },

  async getSource(account: AccountSettings, _folder: string, id: string): Promise<Buffer> {
    const ctx = context(account)
    return source(ctx, await getEmail(ctx, id, ['id', 'blobId', 'size']))
  },

  async setFlags(account: AccountSettings, _folder: string, id: string, flags: { unread?: boolean, flagged?: boolean }): Promise<void> {
    const patch = jmapFlagPatch(flags)
    if (Object.keys(patch).length) await updateEmails(context(account), { [id]: patch })
  },

  async move(account: AccountSettings, folder: string, id: string, to: string): Promise<void> {
    const ctx = context(account)
    const list = await mailboxes(ctx)
    const from = mailboxIn(list, folder)
    const destination = ['inbox', 'archive', 'trash', 'junk'].includes(to)
      ? await roleMailbox(ctx, to as FolderRole, to === 'archive', list)
      : findJmapMailbox(list, to)
    if (!destination) throw createError({ status: 400, message: `This account has no ${to} folder.` })
    if (destination.id === from.id) return
    await updateEmails(ctx, { [id]: jmapMovePatch(from.id, destination.id) })
  },

  /** To Trash, or gone for good when it's already there (or there's no Trash) */
  async remove(account: AccountSettings, folder: string, id: string): Promise<void> {
    const ctx = context(account)
    const list = await mailboxes(ctx)
    const from = mailboxIn(list, folder)
    const trash = findJmapRole(list, 'trash')
    if (trash && trash.id !== from.id) await updateEmails(ctx, { [id]: jmapMovePatch(from.id, trash.id) })
    else await destroyEmail(ctx, id)
  },

  async createFolder(account: AccountSettings, name: string, parent?: string): Promise<string> {
    const ctx = context(account)
    const list = await mailboxes(ctx)
    const parentId = parent ? mailboxIn(list, parent).id : null
    if (sameName(list, parentId, name)) throw createError({ status: 409, message: `There's already a folder called “${name}”.` })
    const result = await call(ctx, 'Mailbox/set', { create: { new: { name, parentId } } })
    return String(jmapSetResult(result, 'created', 'new').id)
  },

  async renameFolder(account: AccountSettings, path: string, name: string): Promise<string> {
    const ctx = context(account)
    const list = await mailboxes(ctx)
    const mailbox = mailboxIn(list, path)
    if (mailbox.role) throw createError({ status: 400, message: `${mailbox.name} can't be renamed.` })
    if (sameName(list, mailbox.parentId ?? null, name, mailbox.id)) throw createError({ status: 409, message: `There's already a folder called “${name}”.` })
    jmapSetResult(await call(ctx, 'Mailbox/set', { update: { [mailbox.id]: { name } } }), 'updated', mailbox.id)
    // The id doesn't change with the name, so neither does the path
    return path
  },

  /**
   * Removes a folder, never the mail in it: its messages, and those of any
   * folder inside it, go back to the Inbox first. Returns how many moved
   */
  async deleteFolder(account: AccountSettings, path: string): Promise<number> {
    const ctx = context(account)
    const list = await mailboxes(ctx)
    const mailbox = findJmapMailbox(list, path)
    if (!mailbox) return 0
    if (mailbox.role) throw createError({ status: 400, message: `${mailbox.name} can't be deleted.` })
    const inbox = mailboxIn(list, JMAP_INBOX)
    const tree = jmapMailboxTree(list, mailbox.id)

    let moved = 0
    for (const folder of tree) {
      // Each batch leaves the folder, so the next query starts from the top again
      for (let round = 0; round < 1000; round++) {
        const ids = ((await call(ctx, 'Email/query', { filter: { inMailbox: folder.id }, limit: BATCH })).ids as string[] | undefined) ?? []
        if (!ids.length) break
        await updateEmails(ctx, Object.fromEntries(ids.map(id => [id, jmapMovePatch(folder.id, inbox.id)])))
        moved += ids.length
      }
    }
    // Deepest first, so a parent has no folders left by the time it goes
    const id = await accountId(ctx)
    const calls: JmapCall[] = tree.map((folder, i) => ['Mailbox/set', { accountId: id, destroy: [folder.id], onDestroyRemoveEmails: false }, `d${i}`])
    const responses = await jmapRequest(ctx, calls)
    tree.forEach((folder, i) => jmapSetResult(responses.get(`d${i}`), 'destroyed', folder.id))
    return moved
  },

  /** Saves a draft, replacing the copy saved before it */
  async saveDraft(account: AccountSettings, raw: Buffer, replace?: DraftRef): Promise<DraftRef> {
    const ctx = context(account)
    const drafts = await roleMailbox(ctx, 'drafts', true)
    if (!drafts) throw createError({ status: 400, message: 'This account has no Drafts folder.' })
    const id = await importEmail(ctx, raw, drafts.id, { $draft: true, $seen: true })
    // Only once the new copy is safely saved
    if (replace) await this.discardDraft(account, replace).catch(() => {})
    return { folder: jmapFolderPath(drafts), id }
  },

  async discardDraft(account: AccountSettings, draft: DraftRef): Promise<void> {
    if (!JMAP_ID.test(draft.id)) return
    await destroyEmail(context(account), draft.id)
  },

  /** A copy in Sent, for mail that went out over SMTP */
  async appendSent(account: AccountSettings, raw: Buffer): Promise<void> {
    const ctx = context(account)
    const sent = await roleMailbox(ctx, 'sent', true)
    if (sent) await importEmail(ctx, raw, sent.id, { $seen: true })
  },

  /**
   * Sends through the server (EmailSubmission): the message is stored in
   * Drafts, submitted, and on success moved to Sent. When the copy for Sent
   * differs from what went out (the tracking image), the sent one is
   * destroyed instead and the clean copy filed
   */
  async submit(account: AccountSettings, raw: Buffer, envelope: { from: string, to: string[] }, sentCopy: Buffer): Promise<void> {
    const ctx = context(account)
    const list = await mailboxes(ctx)
    const drafts = await roleMailbox(ctx, 'drafts', true, list)
    const sent = await roleMailbox(ctx, 'sent', true, list)
    if (!drafts || !sent) throw createError({ status: 400, message: 'This account has no Drafts or Sent folder to send from.' })
    const identities = ((await call(ctx, 'Identity/get', {})).list as { id: string, email: string }[] | undefined) ?? []
    const identityId = pickJmapIdentity(identities, account.email)
    if (!identityId) throw createError({ status: 400, message: 'The server has no sending identity for this address.' })

    const id = await importEmail(ctx, raw, drafts.id, { $draft: true, $seen: true })
    const clean = sentCopy === raw || sentCopy.equals(raw)
    const result = await call(ctx, 'EmailSubmission/set', {
      create: {
        send: {
          identityId,
          emailId: id,
          envelope: { mailFrom: { email: envelope.from }, rcptTo: envelope.to.map(email => ({ email })) }
        }
      },
      ...(clean
        ? { onSuccessUpdateEmail: { '#send': { [`mailboxIds/${drafts.id}`]: null, [`mailboxIds/${sent.id}`]: true, 'keywords/$draft': null } } }
        : { onSuccessDestroyEmail: ['#send'] })
    }).catch(async (error) => {
      await destroyEmail(ctx, id).catch(() => {})
      throw error
    })
    try {
      jmapSetResult(result, 'created', 'send')
    } catch (error) {
      // Not sent: the copy made for sending shouldn't linger in Drafts
      await destroyEmail(ctx, id).catch(() => {})
      throw error
    }
    if (!clean) await importEmail(ctx, sentCopy, sent.id, { $seen: true }).catch(() => {})
  },

  /**
   * One search across every folder but Trash and Junk, newest first. Used by
   * AI search, which builds imapflow search criteria
   */
  async searchAll(account: AccountSettings, criteria: SearchLike, limit = 40): Promise<MessageSummary[]> {
    const ctx = context(account)
    const list = await mailboxes(ctx)
    const skip = list.filter(m => m.role === 'trash' || m.role === 'junk').map(m => m.id)
    const conditions = [jmapSearchFilter(criteria), ...(skip.length ? [{ inMailboxOtherThan: skip }] : [])].filter(c => Object.keys(c).length)
    const filter = conditions.length > 1 ? { operator: 'AND', conditions } : conditions[0] ?? {}
    const page = readJmapPage(await jmapRequest(ctx, jmapQueryCalls(await accountId(ctx), filter, { limit })), email => jmapFolderOf(email, list))
    return page.messages
  }
}
