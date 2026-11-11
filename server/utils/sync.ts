import { accountKey, inBackground, withImap, withMailbox } from './imap'
import { SYNC_FOLDER } from './mail-imap'

/**
 * Settings used to travel between devices as a message in a "CitrusMail
 * Settings" folder of the mailbox. Nothing proved CitrusMail wrote that
 * message, so anything able to put mail in that folder could change a
 * mailbox's rules and signature. Settings now stay on each device, and the
 * old folder is removed once per mailbox per device, only when it holds
 * nothing but CitrusMail's own copies
 */
const OWN_SUBJECT = /^CitrusMail settings$/
const RETIRED = 'sync-retired'
const started = new Set<string>()

export function retireSyncFolder(account: AccountSettings) {
  if (account.incoming.protocol === 'pop3') return
  const key = accountKey(account)
  if (started.has(key)) return
  started.add(key)
  inBackground(async () => {
    if (await readLocal(account, RETIRED)) return
    const removed = account.incoming.protocol === 'jmap'
      ? await jmapRetireSettingsFolder(account, OWN_SUBJECT)
      : await retireImap(account)
    if (!removed) console.warn(`[CitrusMail] Left "${SYNC_FOLDER}" in place: it holds mail CitrusMail didn't write`)
    await writeLocal(account, RETIRED, { at: Date.now() })
  }).catch(() => started.delete(key))
}

/** True when the folder is gone (or never was) */
async function retireImap(account: AccountSettings): Promise<boolean> {
  const exists = await withImap(account, async client => (await client.list()).some(entry => entry.path === SYNC_FOLDER))
  if (!exists) return true
  const ours = await withMailbox(account, SYNC_FOLDER, async (client) => {
    if (!client.mailbox || !client.mailbox.exists) return true
    const messages = await client.fetchAll('1:*', { envelope: true })
    return messages.every(message => OWN_SUBJECT.test(message.envelope?.subject ?? ''))
  })
  if (!ours) return false
  // Some servers won't delete the folder a connection has open
  await withImap(account, async (client) => {
    if (client.mailbox && client.mailbox.path === SYNC_FOLDER) await client.mailboxOpen('INBOX')
    await client.mailboxDelete(SYNC_FOLDER)
  })
  return true
}
