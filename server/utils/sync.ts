import { simpleParser } from 'mailparser'
import MailComposer from 'nodemailer/lib/mail-composer'
import { accountKey, inBackground, withImap, withMailbox } from './imap'
import { SYNC_FOLDER } from './mail-imap'
import { SYNCED, readLocal, writeLocal } from './store'
import type { SyncMeta, SyncedName } from './store'

/**
 * Settings that follow you: a copy of every synced store is kept as one
 * message in a folder of its own in your mailbox. Each device reads it when
 * it needs a setting (at most every two minutes) and takes anything newer;
 * each change writes a fresh copy a few seconds later. The folder is left
 * unsubscribed, so most mail programs don't show it. On JMAP the same folder
 * holds it (mail-jmap-extras.ts). POP3 has no folders,
 * so POP3 accounts keep their settings on this device only
 */
const ATTACHMENT = 'citrusmail-settings.json'
const PULL_EVERY = 2 * 60_000
const PULL_TIMEOUT = 4000
const PUSH_DELAY = 3000

interface SyncFile {
  version: 1
  stores: Partial<Record<SyncedName, { updatedAt: number, value: unknown }>>
}

const lastPull = new Map<string, number>()
const pulling = new Map<string, Promise<void>>()
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>()

/** AI keys are sealed for this server; in the mailbox they're sealed with the mail password instead */
async function toMailbox(account: AccountSettings, name: SyncedName, value: unknown) {
  if (name !== 'ai' || !value) return value
  const local = value as { sealed?: string }
  if (!local.sealed) return value
  return { owner: sealForOwner(account, await unsealValue(local.sealed)) }
}

async function fromMailbox(account: AccountSettings, name: SyncedName, value: unknown) {
  if (name !== 'ai' || !value) return value
  const remote = value as { owner?: string }
  const keys = remote.owner ? unsealForOwner(account, remote.owner) : undefined
  return keys ? { sealed: await sealValue(keys) } : undefined
}

async function readRemote(account: AccountSettings): Promise<SyncFile | undefined> {
  const source = account.incoming.protocol === 'jmap'
    ? await jmapReadSettings(account)
    : await withMailbox(account, SYNC_FOLDER, async (client) => {
        if (!client.mailbox || !client.mailbox.exists) return undefined
        const message = await client.fetchOne('*', { uid: true, source: true })
        return message ? message.source : undefined
      })
  if (!source) return undefined
  const parsed = await simpleParser(source)
  const file = parsed.attachments.find(attachment => attachment.filename === ATTACHMENT)
  if (!file) return undefined
  const data = JSON.parse(file.content.toString('utf8')) as SyncFile
  return data.version === 1 ? data : undefined
}

async function pull(account: AccountSettings) {
  // No settings folder yet reads as nothing to take
  const remote = await readRemote(account).catch(() => undefined)
  const meta = await readLocal<SyncMeta>(account, 'sync-meta')
  // Marks this device as having synced once, even when there was nothing to take
  if (!remote) {
    if (!meta) await writeLocal(account, 'sync-meta', {})
    return
  }
  if (!meta) await writeLocal(account, 'sync-meta', {})
  return apply(account, remote, meta ?? {})
}

async function apply(account: AccountSettings, remote: SyncFile, meta: SyncMeta) {
  let changed = false
  for (const name of SYNCED) {
    const entry = remote.stores[name]
    if (!entry || entry.updatedAt <= (meta[name] ?? 0)) continue
    const value = await fromMailbox(account, name, entry.value)
    if (value === undefined) continue
    await writeLocal(account, name, value)
    meta[name] = entry.updatedAt
    changed = true
  }
  if (changed) await writeLocal(account, 'sync-meta', meta)
}

/**
 * Takes newer settings from the mailbox, in the background: requests carry on
 * with what this device has and the next one sees anything newer. Only a
 * device that has never synced waits (briefly) for the first copy
 */
export async function pullSettings(account: AccountSettings): Promise<void> {
  if (account.incoming.protocol === 'pop3') return
  const key = accountKey(account)
  const fresh = !(await readLocal(account, 'sync-meta'))
  if (Date.now() - (lastPull.get(key) ?? 0) < PULL_EVERY) return fresh ? pulling.get(key) : undefined
  lastPull.set(key, Date.now())

  const running = inBackground(() => pull(account)).catch(() => {}).finally(() => pulling.delete(key))
  pulling.set(key, running)
  if (fresh) await Promise.race([running, new Promise(resolve => setTimeout(resolve, PULL_TIMEOUT))])
}

async function push(account: AccountSettings) {
  const meta = await readLocal<SyncMeta>(account, 'sync-meta') ?? {}
  const file: SyncFile = { version: 1, stores: {} }
  for (const name of SYNCED) {
    const value = await readLocal(account, name)
    if (value === null || !meta[name]) continue
    file.stores[name] = { updatedAt: meta[name]!, value: await toMailbox(account, name, value) }
  }

  const raw = await new MailComposer({
    from: { name: 'CitrusMail', address: account.email },
    to: account.email,
    subject: 'CitrusMail settings',
    text: 'CitrusMail keeps your settings here so they follow you to every device you sign in on. Deleting this message resets them on new devices.',
    attachments: [{ filename: ATTACHMENT, contentType: 'application/json', content: JSON.stringify(file) }]
  }).compile().build()

  if (account.incoming.protocol === 'jmap') return jmapWriteSettings(account, raw)
  await withImap(account, async (client) => {
    const list = await client.list()
    if (!list.some(entry => entry.path === SYNC_FOLDER)) await client.mailboxCreate(SYNC_FOLDER)
    await client.append(SYNC_FOLDER, raw, ['\\Seen'])
  })
  // Only the newest copy is kept
  await withMailbox(account, SYNC_FOLDER, async (client) => {
    const uids = await client.search({ all: true }, { uid: true })
    if (Array.isArray(uids) && uids.length > 1) {
      const newest = Math.max(...uids)
      await client.messageDelete(uids.filter(uid => uid !== newest).join(','), { uid: true })
    }
  })
}

/** Writes the settings to the mailbox a moment after the last change */
export function pushSettings(account: AccountSettings) {
  if (account.incoming.protocol === 'pop3') return
  const key = accountKey(account)
  clearTimeout(pushTimers.get(key))
  const timer = setTimeout(() => {
    pushTimers.delete(key)
    inBackground(() => push(account)).catch(error => console.warn('[CitrusMail] Couldn\'t sync settings to the mailbox:', (error as Error).message))
  }, PUSH_DELAY)
  timer.unref?.()
  pushTimers.set(key, timer)
}
