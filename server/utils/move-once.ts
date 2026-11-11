import type { FetchMessageObject, SearchObject } from 'imapflow'
import { accountKey, withMailbox } from './imap'

/**
 * Mail CitrusMail moves on its own (folder rules, the sender lists) moves to
 * a folder once per message, and never into a folder that already has it.
 * iCloud can leave the original behind after a move; moving it again on every
 * check once filled an Inbox with 68,000 copies. What was moved is kept by
 * Message-ID and destination on this device
 */
const MOVED = 'senders-moved'
const MAX_MOVED = 20_000
const records = new Map<string, Promise<Set<string>>>()

function movedFor(account: AccountSettings) {
  const key = accountKey(account)
  let record = records.get(key)
  if (!record) {
    record = readLocal<string[]>(account, MOVED).then(list => new Set(list ?? []), () => new Set<string>())
    records.set(key, record)
  }
  return record
}

interface Candidate { uid: number, key: string, messageId?: string }

/** Message-IDs among `ids` that `folder` already holds */
async function alreadyIn(account: AccountSettings, folder: string, ids: string[]): Promise<Set<string>> {
  const found = new Set<string>()
  for (let i = 0; i < ids.length; i += 15) {
    const slice = ids.slice(i, i + 15)
    const criteria: SearchObject = slice.length === 1 ? { header: { 'message-id': slice[0]! } } : { or: slice.map(id => ({ header: { 'message-id': id } })) }
    await withMailbox(account, folder, async (client) => {
      const uids = await client.search(criteria, { uid: true }).catch(() => false)
      if (!Array.isArray(uids) || !uids.length) return
      for (const msg of await client.fetchAll(uids.join(','), { uid: true, envelope: true }, { uid: true })) {
        if (msg.envelope?.messageId) found.add(msg.envelope.messageId)
      }
    })
  }
  return found
}

export interface AutoMove {
  from: string
  to: string
  criteria: SearchObject
  /** Checks each found message (its envelope and arrival time), as a search can match more */
  keep?: (message: FetchMessageObject) => boolean
  markRead?: boolean
}

/** Moves what `criteria` finds in `from` to `to`, each message once. Returns how many moved */
export async function moveOnce(account: AccountSettings, { from, to, criteria, keep, markRead }: AutoMove): Promise<number> {
  const done = await movedFor(account)
  const candidates = await withMailbox(account, from, async (client): Promise<Candidate[]> => {
    const uids = await client.search(criteria, { uid: true }).catch(() => false)
    if (!Array.isArray(uids) || !uids.length) return []
    const fetched = await client.fetchAll(uids.join(','), { uid: true, envelope: true, internalDate: true }, { uid: true })
    const validity = client.mailbox ? String(client.mailbox.uidValidity) : ''
    return fetched
      .filter(msg => !keep || keep(msg))
      .map(msg => ({ uid: msg.uid, messageId: msg.envelope?.messageId || undefined, key: `${to}\0${msg.envelope?.messageId || `${from}:${validity}:${msg.uid}`}` }))
      .filter(msg => !done.has(msg.key))
  })
  if (!candidates.length) return 0

  // A copy already there (left behind by an earlier move) isn't made again
  const before = done.size
  const there = await alreadyIn(account, to, candidates.flatMap(msg => msg.messageId ?? []))
  for (const msg of candidates) if (msg.messageId && there.has(msg.messageId)) done.add(msg.key)
  const wanted = candidates.filter(msg => !done.has(msg.key))

  const moved = !wanted.length
    ? 0
    : await withMailbox(account, from, async (client) => {
        const range = wanted.map(msg => msg.uid).join(',')
        if (markRead) await client.messageFlagsAdd(range, ['\\Seen'], { uid: true })
        const result = await client.messageMove(range, to, { uid: true }).catch(() => false)
        if (!result) return 0
        wanted.forEach(msg => done.add(msg.key))
        const left = await client.search({ uid: range }, { uid: true }).catch(() => false)
        if (Array.isArray(left) && left.length) console.warn(`[CitrusMail] ${left.length} message(s) stayed in ${from} after moving to ${to}; they won't be moved again`)
        return wanted.length
      })
  if (done.size !== before) {
    const kept = [...done].slice(-MAX_MOVED)
    if (kept.length < done.size) {
      done.clear()
      kept.forEach(key => done.add(key))
    }
    await writeLocal(account, MOVED, kept)
  }
  return moved
}
