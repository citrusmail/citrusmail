import { createError } from 'nuxt/server'
import { simpleParser } from 'mailparser'
import { accountKey } from './imap'
import { withPop3 } from './pop3'
import type { Pop3Client } from './pop3'
import type { ListQuery } from './mail-imap'

const PAGE = 50
const INBOX = 'INBOX'

// Headers + a few body lines per message, so paging back and forth doesn't re-download them
const summaries = new Map<string, MessageSummary>()

function remember(key: string, summary: MessageSummary) {
  summaries.set(key, summary)
  if (summaries.size > 5000) summaries.delete(summaries.keys().next().value!)
}

async function summarize(client: Pop3Client, n: number, uid: string): Promise<MessageSummary> {
  const head = await client.top(n, 30)
  const parsed = await simpleParser(head)
  const contentType = parsed.headers.get('content-type') as { value?: string } | undefined
  return {
    id: uid,
    folder: INBOX,
    subject: parsed.subject ?? '',
    from: flattenAddresses(parsed.from)[0] ?? { address: '' },
    to: flattenAddresses(parsed.to),
    date: (parsed.date ?? new Date(0)).toISOString(),
    preview: makePreview(parsed.text || (parsed.html ? htmlToText(parsed.html) : '')),
    unread: false,
    flagged: false,
    hasAttachments: contentType?.value === 'multipart/mixed' || parsed.attachments.length > 0
  }
}

async function findNumber(client: Pop3Client, id: string) {
  const entry = (await client.uidl()).find(e => e.uid === id)
  if (!entry) throw createError({ status: 404, message: 'This message no longer exists.' })
  return entry.n
}

function onlyInbox(folder: string) {
  if (folder !== INBOX) throw createError({ status: 400, message: 'POP3 accounts only have an Inbox.' })
}

export const pop3Backend = {
  async listFolders(_account: AccountSettings): Promise<Folder[]> {
    return [{ path: INBOX, name: 'Inbox', role: 'inbox', unread: 0, depth: 0 }]
  },

  listMessages(account: AccountSettings, folder: string, { before, q, unread, flagged, from, within, on, attachments }: ListQuery): Promise<MessagePage> {
    onlyInbox(folder)
    // POP3 has no read state or flags, so nothing is unread or flagged
    if (unread || flagged) return Promise.resolve({ messages: [], total: 0 })
    const key = accountKey(account)
    return withPop3(account, async (client) => {
      const all = await client.uidl()
      const end = before ? all.findIndex(e => e.uid === before) : all.length
      const older = all.slice(0, end < 0 ? 0 : end)
      const page = older.slice(-PAGE).reverse()

      const messages: MessageSummary[] = []
      for (const { n, uid } of page) {
        const cacheKey = `${key}:${uid}`
        const summary = summaries.get(cacheKey) ?? await summarize(client, n, uid)
        remember(cacheKey, summary)
        messages.push(summary)
      }
      // Search is limited to the loaded page: POP3 has no server-side search
      const needle = q?.toLowerCase()
      const sender = from?.toLowerCase()
      const since = within ? Date.now() - { week: 7, month: 31, year: 365 }[within] * 86_400_000 : 0
      const shown = messages.filter(m =>
        (!needle || `${m.subject} ${m.from.name ?? ''} ${m.from.address} ${m.preview}`.toLowerCase().includes(needle))
        && (!sender || `${m.from.name ?? ''} ${m.from.address}`.toLowerCase().includes(sender))
        && (!since || new Date(m.date).getTime() >= since)
        && (!on || m.date.slice(0, 10) === on)
        && (!attachments || m.hasAttachments))
      return { messages: shown, total: all.length, cursor: older.length > PAGE ? page.at(-1)!.uid : undefined }
    })
  },

  async getSource(account: AccountSettings, folder: string, id: string): Promise<Buffer> {
    onlyInbox(folder)
    return withPop3(account, async client => client.retr(await findNumber(client, id)))
  },

  async getMessage(account: AccountSettings, folder: string, id: string, allowRemote: RemotePolicy): Promise<MessageDetail> {
    const parsed = await simpleParser(await this.getSource(account, folder, id), { skipImageLinks: true })
    return toMessageDetail(parsed, { id, folder, unread: false, flagged: false }, allowRemote)
  },

  async setFlags(_account: AccountSettings, _folder: string, _id: string, _flags: { unread?: boolean, flagged?: boolean }): Promise<void> {},

  async move(_account: AccountSettings, _folder: string, _id: string, _to: string): Promise<void> {
    throw createError({ status: 400, message: 'POP3 accounts only have an Inbox, so messages can\'t be moved.' })
  },

  async remove(account: AccountSettings, folder: string, id: string): Promise<void> {
    onlyInbox(folder)
    await withPop3(account, async client => client.dele(await findNumber(client, id)))
    summaries.delete(`${accountKey(account)}:${id}`)
  },

  async createFolder(_account: AccountSettings, _name: string, _parent?: string): Promise<string> {
    throw createError({ status: 400, message: 'POP3 accounts only have an Inbox.' })
  },

  async renameFolder(_account: AccountSettings, _path: string, _name: string): Promise<string> {
    throw createError({ status: 400, message: 'POP3 accounts only have an Inbox.' })
  },

  async deleteFolder(_account: AccountSettings, _path: string): Promise<number> {
    throw createError({ status: 400, message: 'POP3 accounts only have an Inbox.' })
  },

  async appendSent(_account: AccountSettings, _raw: Buffer): Promise<void> {},

  async saveDraft(_account: AccountSettings, _raw: Buffer, _replace?: DraftRef): Promise<DraftRef> {
    throw createError({ status: 400, message: 'POP3 accounts have no Drafts folder on the server.' })
  },

  async discardDraft(_account: AccountSettings, _draft: DraftRef): Promise<void> {},

  async searchAll(account: AccountSettings, criteria: { body?: string }, limit = 40): Promise<MessageSummary[]> {
    const page = await this.listMessages(account, INBOX, { q: criteria.body })
    return page.messages.slice(0, limit)
  }
}
