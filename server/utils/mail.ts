import type { SearchObject } from 'imapflow'
import { simpleParser } from 'mailparser'
import { createError } from 'nuxt/server'
import { imapBackend } from './mail-imap'
import type { ListQuery } from './mail-imap'
import { pop3Backend } from './mail-pop3'
import { jmapBackend, jmapCanSubmit } from './mail-jmap'
import { JMAP_ID } from './jmap'

/**
 * The protocol-agnostic mail API the routes call. POP3 accounts have a single
 * Inbox, no flags and no server-side folders; IMAP and JMAP get everything.
 */
/**
 * IMAP ids are single UIDs: a sequence set like `1:*` would act on the whole
 * folder. JMAP ids are opaque strings from a URL-safe alphabet
 */
function checkId(account: AccountSettings, id: string) {
  const { protocol } = account.incoming
  const valid = protocol === 'pop3' || (protocol === 'jmap' ? JMAP_ID : /^\d{1,10}$/).test(id)
  if (!valid) throw createError({ status: 400, message: 'Invalid message id' })
  return id
}

function backendFor(account: AccountSettings) {
  const { protocol } = account.incoming
  return protocol === 'pop3' ? pop3Backend : protocol === 'jmap' ? jmapBackend : imapBackend
}

export function mailFor(account: AccountSettings) {
  const backend = backendFor(account)
  const id = (value: string) => checkId(account, value)
  return {
    listFolders: () => backend.listFolders(account),
    listMessages: (folder: string, query: ListQuery) => backend.listMessages(account, folder, query),
    getMessage: (folder: string, messageId: string, allowRemote: RemotePolicy = false) => backend.getMessage(account, folder, id(messageId), allowRemote),
    setFlags: (folder: string, messageId: string, flags: { unread?: boolean, flagged?: boolean }) => backend.setFlags(account, folder, id(messageId), flags),
    move: (folder: string, messageId: string, to: string) => backend.move(account, folder, id(messageId), to),
    remove: (folder: string, messageId: string) => backend.remove(account, folder, id(messageId)),
    async getAttachment(folder: string, messageId: string, index: number) {
      const parsed = await simpleParser(await backend.getSource(account, folder, id(messageId)), { skipImageLinks: true })
      return parsed.attachments[index]
    },
    getSource: (folder: string, messageId: string) => backend.getSource(account, folder, id(messageId)),
    createFolder: (name: string, parent?: string) => backend.createFolder(account, name, parent),
    renameFolder: (path: string, name: string) => backend.renameFolder(account, path, name),
    deleteFolder: (path: string) => backend.deleteFolder(account, path),
    appendSent: (raw: Buffer) => backend.appendSent(account, raw),
    saveDraft: (raw: Buffer, replace?: DraftRef) => backend.saveDraft(account, raw, replace),
    discardDraft: (draft: DraftRef) => backend.discardDraft(account, draft),
    searchAll: (criteria: SearchObject, limit?: number) => backend.searchAll(account, criteria, limit),
    /**
     * Sends and files the message in Sent. A JMAP server that can send does
     * both itself (EmailSubmission); everything else goes out over SMTP
     */
    async send(message: OutgoingMessage): Promise<{ messageId: string }> {
      if (account.incoming.protocol === 'jmap' && await jmapCanSubmit(account)) {
        return sendMail(account, message, (raw, envelope, sentCopy) => jmapBackend.submit(account, raw, envelope, sentCopy))
      }
      const sent = await sendMail(account, message)
      // The message is out: a Sent folder that can't be written to is not worth an error
      await backend.appendSent(account, sent.raw).catch(() => {})
      return sent
    }
  }
}
