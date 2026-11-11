import type { SearchObject } from 'imapflow'
import { withMailbox } from './imap'
import { rolePathFor } from './mail-imap'

export const DEFAULT_SENDERS: SenderLists = { allowed: [], blocked: [], blockAction: 'junk' }

export async function readSenders(account: AccountSettings): Promise<SenderLists> {
  return { ...DEFAULT_SENDERS, ...await readStore<Partial<SenderLists>>(account, 'senders', {}) }
}

/** An entry is an address, or a domain written @example.com (which also covers its subdomains) */
export function senderMatches(list: string[], address?: string): boolean {
  const email = address?.trim().toLowerCase()
  if (!email || !email.includes('@')) return false
  const domain = email.slice(email.indexOf('@') + 1)
  return list.some((entry) => {
    if (!entry.startsWith('@')) return entry === email
    const wanted = entry.slice(1)
    return domain === wanted || domain.endsWith(`.${wanted}`)
  })
}

/** IMAP FROM is a substring match, so `@example.com` finds the whole domain */
function anyFrom(entries: string[]): SearchObject | undefined {
  if (!entries.length) return undefined
  if (entries.length === 1) return { from: entries[0] }
  return { or: entries.map(entry => ({ from: entry })) }
}

async function moveMatching(account: AccountSettings, from: string, entries: string[], to: string): Promise<number> {
  let moved = 0
  // Long OR chains trip some servers, so a big list goes in slices
  for (let i = 0; i < entries.length; i += 15) {
    const criteria = anyFrom(entries.slice(i, i + 15))
    if (!criteria) continue
    moved += await withMailbox(account, from, async (client) => {
      const uids = await client.search(criteria, { uid: true }).catch(() => false)
      if (!Array.isArray(uids) || !uids.length) return 0
      // A substring match can catch more than the list means; check each sender
      const fetched = await client.fetchAll(uids.join(','), { uid: true, envelope: true }, { uid: true })
      const exact = fetched.filter(msg => senderMatches(entries, msg.envelope?.from?.[0]?.address)).map(msg => msg.uid)
      if (!exact.length) return 0
      const result = await client.messageMove(exact.join(','), to, { uid: true }).catch(() => false)
      return result ? exact.length : 0
    })
  }
  return moved
}

/**
 * Blocked senders leave the Inbox for Junk (or Trash), and allowed senders
 * that landed in Junk come back. Runs with the rules each time mail is checked
 */
export async function applySenderLists(account: AccountSettings): Promise<number> {
  if (account.incoming.protocol === 'pop3') return 0
  const lists = await readSenders(account)
  if (!lists.allowed.length && !lists.blocked.length) return 0
  if (account.incoming.protocol === 'jmap') return jmapApplySenderLists(account, lists)

  const junk = await rolePathFor(account, 'junk')
  const bin = lists.blockAction === 'trash' ? await rolePathFor(account, 'trash') : junk
  let moved = 0
  if (lists.blocked.length && bin) moved += await moveMatching(account, 'INBOX', lists.blocked, bin)
  if (lists.allowed.length && junk) moved += await moveMatching(account, junk, lists.allowed, 'INBOX')
  return moved
}
