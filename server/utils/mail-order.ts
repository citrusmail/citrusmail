import { createHash } from 'node:crypto'
import type { ImapFlow } from 'imapflow'

/**
 * Mail is listed newest first by when it was received, not by the order it
 * reached the folder: a message moved or restored into the Inbox today keeps
 * its place among the mail of its own day. The time used is the earlier of
 * the Date header and the server's arrival time, so a re-filed message goes
 * back where it was and a message with a far-future Date can't sit on top.
 * The times for a folder are fetched once and topped up as mail arrives
 */
interface FolderIndex {
  uidNext: number
  exists: number
  times: Map<number, number>
}

const indexes = new Map<string, FolderIndex>()
const MAX_INDEXES = 200

export function sortTime(header: Date | string | undefined, internal: Date | string | undefined): number {
  const sent = header ? new Date(header).getTime() : Number.NaN
  const received = internal ? new Date(internal).getTime() : Number.NaN
  if (Number.isNaN(sent)) return Number.isNaN(received) ? 0 : received
  if (Number.isNaN(received)) return sent
  return Math.min(sent, received)
}

async function fetchTimes(client: ImapFlow, range: string, into: Map<number, number>) {
  // Just the Date header, a few dozen bytes a message
  for await (const msg of client.fetch(range, { uid: true, internalDate: true, headers: ['date'] }, { uid: true })) {
    const header = msg.headers?.toString('utf8').match(/^date:\s*(.+)$/im)?.[1]?.trim()
    into.set(msg.uid, sortTime(header, msg.internalDate))
  }
}

// Kept on disk too, so a restart doesn't mean reading every date again
const storeKey = (id: string) => `order:${createHash('sha256').update(id).digest('hex').slice(0, 32)}`

async function stored(id: string): Promise<FolderIndex | undefined> {
  const saved = await useStorage('citrusmail').getItem<{ uidNext: number, exists: number, pairs: [number, number][] }>(storeKey(id))
  return saved ? { uidNext: saved.uidNext, exists: saved.exists, times: new Map(saved.pairs) } : undefined
}

function save(id: string, index: FolderIndex) {
  useStorage('citrusmail').setItem(storeKey(id), { uidNext: index.uidNext, exists: index.exists, pairs: [...index.times] }).catch(() => {})
}

/** Received times for every message in the selected folder, by UID */
export async function folderTimes(client: ImapFlow, key: string): Promise<Map<number, number>> {
  const box = client.mailbox
  if (!box || !box.exists) return new Map()
  const uidNext = Number(box.uidNext ?? 0)
  const id = `${key}\0${box.path}\0${box.uidValidity}`
  const index = indexes.get(id) ?? await stored(id) ?? { uidNext: 1, exists: 0, times: new Map() }
  if (index.uidNext === uidNext && index.exists === box.exists && index.times.size === box.exists) {
    remember(id, index)
    return index.times
  }

  // New mail: only what arrived since last time
  if (uidNext > index.uidNext) await fetchTimes(client, `${index.uidNext}:*`, index.times)
  // Mail went away (or was moved in under an old UID): one cheap list of UIDs
  // says which, and only the unknown ones are fetched
  if (index.times.size !== box.exists) {
    const uids = await client.search({ all: true }, { uid: true }) || []
    const present = new Set(uids)
    for (const uid of index.times.keys()) if (!present.has(uid)) index.times.delete(uid)
    const missing = uids.filter(uid => !index.times.has(uid))
    for (let i = 0; i < missing.length; i += 500) await fetchTimes(client, missing.slice(i, i + 500).join(','), index.times)
  }
  index.uidNext = uidNext
  index.exists = box.exists
  remember(id, index)
  save(id, index)
  return index.times
}

/**
 * Messages that left the selected folder (moved, deleted, or found missing).
 * Taking them out of the index means the count no longer matches, so the next
 * listing asks the server which UIDs are really there, even if the
 * connection hasn't heard about the change yet
 */
export function forgetUids(client: ImapFlow, key: string, uids: number[]) {
  const box = client.mailbox
  if (!box || !uids.length) return
  const id = `${key}\0${box.path}\0${box.uidValidity}`
  const index = indexes.get(id)
  if (!index) return
  for (const uid of uids) index.times.delete(uid)
  save(id, index)
}

function remember(id: string, index: FolderIndex) {
  indexes.delete(id)
  indexes.set(id, index)
  if (indexes.size > MAX_INDEXES) indexes.delete(indexes.keys().next().value!)
}

/** A page cursor: the time and UID of the last message shown */
export function encodeCursor(time: number, uid: number) {
  return `${time}.${uid}`
}

/** UIDs newest first, after the cursor, one page of them */
export function orderPage(uids: number[], times: Map<number, number>, cursor: string | undefined, size: number) {
  const ordered = uids
    .map(uid => ({ uid, time: times.get(uid) ?? 0 }))
    .sort((a, b) => b.time - a.time || b.uid - a.uid)
  let start = 0
  if (cursor) {
    const [time, uid] = cursor.split('.').map(Number) as [number, number]
    start = ordered.findIndex(item => item.time < time || (item.time === time && item.uid < uid))
    if (start < 0) start = ordered.length
  }
  const page = ordered.slice(start, start + size)
  const last = page.at(-1)
  return {
    uids: page.map(item => item.uid),
    cursor: last && start + size < ordered.length ? encodeCursor(last.time, last.uid) : undefined
  }
}
