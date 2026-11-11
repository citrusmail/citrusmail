import { randomUUID } from 'node:crypto'

/**
 * Send later. A scheduled message waits in server storage, sealed together
 * with the account that sends it (see vault.ts), and the outbox worker
 * (server/plugins/outbox.ts) sends it when its time comes, whether or not
 * anyone has the app open. Each account also keeps a plain list of what is
 * waiting, without the message bodies, for the Scheduled page
 */
interface OutboxItem {
  id: string
  sendAt: number
  attempts: number
  /** { account, message }, sealed */
  sealed: string
}

const MAX_ATTEMPTS = 5
const outbox = () => useStorage('letterbox')
const itemKey = (id: string) => `outbox:${id}.json`

function htmlPreview(html: string) {
  return makePreview(htmlToText(html), 120)
}

export async function listScheduled(account: AccountSettings): Promise<ScheduledMessage[]> {
  const list = await readLocal<ScheduledMessage[]>(account, 'scheduled') ?? []
  return list.sort((a, b) => a.sendAt.localeCompare(b.sendAt))
}

async function updateList(account: AccountSettings, change: (list: ScheduledMessage[]) => ScheduledMessage[]) {
  await writeLocal(account, 'scheduled', change(await listScheduled(account)))
}

export async function scheduleMessage(account: AccountSettings, message: OutgoingMessage, sendAt: Date): Promise<ScheduledMessage> {
  const id = randomUUID()
  const item: OutboxItem = { id, sendAt: sendAt.getTime(), attempts: 0, sealed: await sealValue({ account, message }) }
  await outbox().setItem(itemKey(id), item as never)
  const entry: ScheduledMessage = {
    id,
    sendAt: sendAt.toISOString(),
    to: [...message.to, ...(message.cc ?? []), ...(message.bcc ?? [])],
    subject: message.subject,
    preview: htmlPreview(message.html),
    status: 'waiting'
  }
  await updateList(account, list => [...list, entry])
  return entry
}

/** Takes a message out of the outbox and hands it back, so it can be edited and sent again */
export async function cancelScheduled(account: AccountSettings, id: string): Promise<OutgoingMessage | undefined> {
  const list = await listScheduled(account)
  if (!list.some(entry => entry.id === id)) return undefined
  const item = await outbox().getItem<OutboxItem>(itemKey(id))
  await outbox().removeItem(itemKey(id))
  await updateList(account, entries => entries.filter(entry => entry.id !== id))
  if (!item) return undefined
  const { message } = await unsealValue<{ message: OutgoingMessage }>(item.sealed)
  return message
}

/** Moves a waiting (or failed) message to a new time; a failed one gets a fresh set of tries */
export async function rescheduleMessage(account: AccountSettings, id: string, sendAt: Date): Promise<ScheduledMessage | undefined> {
  const list = await listScheduled(account)
  const entry = list.find(item => item.id === id)
  const item = await outbox().getItem<OutboxItem>(itemKey(id))
  if (!entry || !item) return undefined
  await outbox().setItem(itemKey(id), { ...item, sendAt: sendAt.getTime(), attempts: 0 } as never)
  const next: ScheduledMessage = { ...entry, sendAt: sendAt.toISOString(), status: 'waiting', error: undefined }
  await updateList(account, entries => entries.map(other => other.id === id ? next : other))
  return next
}

let running = false

/** Sends whatever is due. A failure waits a little longer each time, then is reported on the Scheduled page */
export async function runOutbox(): Promise<void> {
  if (running) return
  running = true
  try {
    const keys = await outbox().getKeys('outbox')
    for (const key of keys) {
      const item = await outbox().getItem<OutboxItem>(key)
      if (!item || item.sendAt > Date.now()) continue
      const { account: stored, message } = await unsealValue<{ account: AccountSettings, message: OutgoingMessage }>(item.sealed)
      let account = stored
      try {
        // An OAuth mailbox's token may have expired while the message waited
        account = await freshAccount(stored)
        if (account !== stored) await outbox().setItem(key, { ...item, sealed: await sealValue({ account, message }) } as never)
        // Files it in Sent too (or the JMAP server does)
        await mailFor(account).send(message)
        await outbox().removeItem(key)
        await updateList(account, list => list.filter(entry => entry.id !== item.id))
      } catch (error) {
        const attempts = item.attempts + 1
        const reason = describeMailError(error, account.outgoing, false).message
        if (attempts >= MAX_ATTEMPTS) {
          // Kept, so it can be opened and sent by hand; never retried on its own again
          await outbox().setItem(key, { ...item, attempts, sendAt: Number.MAX_SAFE_INTEGER } as never)
          await updateList(account, list => list.map(entry => entry.id === item.id ? { ...entry, status: 'failed', error: reason } : entry))
        } else {
          await outbox().setItem(key, { ...item, attempts, sendAt: Date.now() + attempts * 2 * 60_000 } as never)
        }
      }
    }
  } finally {
    running = false
  }
}
