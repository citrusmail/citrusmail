import type { ImapFlow } from 'imapflow'
import { inBackground, withImap, withMailbox } from './imap'
import { previews, toSummary } from './mail-imap'

/**
 * What's new since the last look: per folder, the next UID the server will
 * hand out. A folder seen for the first time only sets its cursor, so signing
 * in never rings for mail you already had
 */
export type Cursors = Record<string, number>

export interface NewMail {
  cursors: Cursors
  messages: MessageSummary[]
}

const PER_FOLDER = 5

async function folderNews(client: ImapFlow, account: AccountSettings, path: string, since: number | undefined) {
  const status = await client.status(path, { uidNext: true })
  const next = (status && status.uidNext) || 0
  if (since === undefined || next <= since) return { next, messages: [] as MessageSummary[] }

  const messages = await withMailbox(account, path, async (inner) => {
    const fetched = (await inner.fetchAll(`${since}:*`, { uid: true, envelope: true, flags: true, bodyStructure: true }, { uid: true }))
      // `n:*` always returns the newest message, even when it's older than n
      .filter(msg => msg.uid >= since && !msg.flags?.has('\\Seen'))
      .slice(-PER_FOLDER)
    const texts = await previews(inner, fetched)
    return fetched.map(msg => toSummary(msg, path, texts.get(msg.uid) ?? ''))
  })
  return { next, messages }
}

export function checkNewMail(account: AccountSettings, folders: string[], cursors: Cursors): Promise<NewMail> {
  return inBackground(() => checkNow(account, folders, cursors))
}

async function checkNow(account: AccountSettings, folders: string[], cursors: Cursors): Promise<NewMail> {
  if (account.incoming.protocol === 'pop3') return checkPop3(account, cursors)
  if (account.incoming.protocol === 'jmap') return checkJmap(account, folders, cursors)
  const result: NewMail = { cursors: {}, messages: [] }
  // Reports for messages you tracked are marked read first, so they show as
  // a badge on the sent message instead of ringing as new mail
  if (folders.includes('INBOX')) await collectReceipts(account).catch(() => 0)
  await withImap(account, async (client) => {
    for (const path of folders) {
      try {
        const { next, messages } = await folderNews(client, account, path, cursors[path])
        result.cursors[path] = next
        result.messages.push(...messages)
      } catch {
        // A folder that was renamed or deleted drops out quietly
      }
    }
  })
  return result
}

/** POP3 has no UIDs that grow, so the newest date seen stands in */
async function checkPop3(account: AccountSettings, cursors: Cursors): Promise<NewMail> {
  const page = await mailFor(account).listMessages('INBOX', {})
  const newest = page.messages.reduce((max, msg) => Math.max(max, Date.parse(msg.date) || 0), 0)
  const since = cursors.INBOX
  const messages = since === undefined ? [] : page.messages.filter(msg => (Date.parse(msg.date) || 0) > since).slice(0, PER_FOLDER)
  return { cursors: { INBOX: Math.max(newest, since ?? 0) }, messages }
}

/** JMAP ids don't grow either: the newest unread message's time stands in, per folder */
async function checkJmap(account: AccountSettings, folders: string[], cursors: Cursors): Promise<NewMail> {
  const result: NewMail = { cursors: {}, messages: [] }
  // Reports for tracked messages are marked read first, as on IMAP
  if (folders.includes('INBOX')) await collectReceipts(account).catch(() => 0)
  const mail = mailFor(account)
  for (const path of folders) {
    try {
      const page = await mail.listMessages(path, { unread: true })
      const since = cursors[path]
      const newest = page.messages.reduce((max, msg) => Math.max(max, Date.parse(msg.date) || 0), 0)
      result.cursors[path] = Math.max(newest, since ?? 0)
      if (since !== undefined) result.messages.push(...page.messages.filter(msg => (Date.parse(msg.date) || 0) > since).slice(0, PER_FOLDER))
    } catch {
      // A folder that was renamed or deleted drops out quietly
    }
  }
  return result
}

/** The folders a mailbox notifies for, from Settings → Notifications */
export function notifyFolders(settings: NotificationSettings | undefined, email: string): string[] {
  if (settings && !settings.enabled) return []
  if (settings?.muted.includes(email.toLowerCase())) return []
  const chosen = settings?.folders[email.toLowerCase()]
  return chosen?.length ? chosen.slice(0, 20) : ['INBOX']
}
