// Mailboxes read over JMAP when their server speaks it, IMAP only when it
// doesn't answer (server/utils/protocol-switch.ts). A mailbox changes
// protocol only here, as the app starts and before any mail loads, or when
// the server moved it to IMAP during an outage and the app reloaded.
//
// Message ids differ between the two, so a mailbox that changed has its
// saved message lists dropped: they'd name messages by ids that no longer exist
const SEEN = 'citrusmail-mailbox-protocols'
const LISTS = 'citrusmail-list-cache'

export default defineNuxtPlugin({
  name: 'jmap-upgrade',
  async setup() {
    const { user, fetch } = useUserSession()
    const mailboxes = () => (user.value as SessionAccount | null)?.mailboxes ?? []
    if (mailboxes().some(item => item.protocol === 'imap')) {
      const result = await $fetch<{ switched: string[] }>('/api/session/upgrade', { method: 'POST' }).catch(() => undefined)
      if (result?.switched.length) await fetch()
    }
    // Done before the app shows any mail, so nothing loads the old copies
    forgetChanged(mailboxes())
    watch(mailboxes, forgetChanged)
  }
})

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '') as T
  } catch {
    return fallback
  }
}

function forgetChanged(mailboxes: MailboxSummary[]) {
  const seen = readJson<Record<string, string>>(SEEN, {})
  const changed = new Set<string>()
  let updated = false
  for (const { email, protocol } of mailboxes) {
    if (!protocol) continue
    const key = email.toLowerCase()
    if (seen[key] && seen[key] !== protocol) changed.add(key)
    if (seen[key] !== protocol) updated = true
    seen[key] = protocol
  }
  if (changed.size) {
    // Saved pages are keyed by a JSON array that starts with the address
    const lists = readJson<Record<string, unknown>>(LISTS, {})
    const kept = Object.fromEntries(Object.entries(lists).filter(([key]) => {
      const email = String(readKey(key)[0] ?? '').toLowerCase()
      return !changed.has(email)
    }))
    localStorage.setItem(LISTS, JSON.stringify(kept))
  }
  if (updated) localStorage.setItem(SEEN, JSON.stringify(seen))
}

function readKey(key: string): unknown[] {
  try {
    const value = JSON.parse(key)
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}
