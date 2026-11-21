import type { RequestEvent } from 'nuxt/server'

/**
 * JMAP whenever a mailbox's server speaks it, IMAP when it doesn't answer.
 *
 * Message ids differ between the two (IMAP numbers, JMAP's own ids), so a
 * mailbox never changes protocol in the middle of what the app is showing:
 * - up to JMAP only as the app starts, before it loads any mail
 *   (POST /api/session/upgrade, from plugins/jmap-upgrade.client.ts), when
 *   discovery finds JMAP for the same mail host (/.well-known/jmap, the
 *   _jmap._tcp SRV record, or CITRUSMAIL_JMAP_HOSTS);
 * - down to IMAP when JMAP is down (no answer or a server error, never a
 *   refused password) and the IMAP server kept at sign-in answers; the
 *   request that found it gets a 503 that makes the app reload.
 * Servers entered by hand in Advanced keep the protocol chosen there, unless
 * that's JMAP and it goes down. CITRUSMAIL_JMAP_DISCOVERY=off stops the move
 * to JMAP. The app drops a mailbox's saved message lists when it sees the
 * new protocol in the session, and push starts its new-mail cursors over.
 */

/** How long a JMAP check may hold up the app's start */
const UPGRADE_TIMEOUT = 3_000
/** A mailbox whose JMAP didn't answer isn't asked again for this long */
const RETRY_AFTER = 5 * 60_000
/** A mailbox found to have no JMAP at all isn't asked again for this long */
const NONE_AFTER = 6 * 60 * 60_000
/** At most one outage check per mailbox in this time */
const CHECK_EVERY = 60_000

const nextUpgrade = new Map<string, number>()
const lastOutageCheck = new Map<string, number>()

/** The mailboxes saved with these replaced (same address), then push told */
async function saveSwitched(event: RequestEvent, switched: AccountSettings[]) {
  const byEmail = new Map(switched.map(item => [item.email.toLowerCase(), item]))
  const accounts = await sessionAccounts(event)
  await saveSessionAccounts(event, accounts.map(item => byEmail.get(item.email.toLowerCase()) ?? item))
  await Promise.all(switched.map(item => updatePushAccount(item).catch(() => {})))
}

/** Where an IMAP mailbox's server answers JMAP, found the way sign-in finds it */
async function jmapFor(account: AccountSettings): Promise<IncomingSettings | undefined> {
  const found = await discoverAccount(account.email)
  if (!found.jmap || found.oauth) return undefined
  // Only the server this mailbox already reads from: never a different one
  if (found.incoming?.host.toLowerCase() !== account.incoming.host.toLowerCase()) return undefined
  return jmapIncoming(found.jmap)
}

/** Moves one IMAP mailbox to JMAP if JMAP answers now; the moved settings, or undefined */
async function tryJmap(account: AccountSettings): Promise<AccountSettings | undefined> {
  const jmap = await jmapFor(account)
  if (!jmap) {
    nextUpgrade.set(accountKey(account), Date.now() + NONE_AFTER)
    return undefined
  }
  const next: AccountSettings = { ...account, incoming: jmap, imapFallback: account.incoming }
  const signedIn = await verifyAccount(next)
  return { ...signedIn, imapFallback: account.incoming }
}

/**
 * Every signed-in IMAP mailbox whose server speaks JMAP moves to JMAP, if
 * JMAP answers now. Returns the addresses that moved
 */
export async function upgradeToJmap(event: RequestEvent): Promise<string[]> {
  if (jmapDiscoveryOff()) return []
  const accounts = await sessionAccounts(event)
  const now = Date.now()
  const moved = (await Promise.all(accounts.map(async (account) => {
    if (account.incoming.protocol !== 'imap' || account.oauth || account.serversChosen) return undefined
    const key = accountKey(account)
    if (now < (nextUpgrade.get(key) ?? 0)) return undefined
    try {
      const next = await withDeadline(tryJmap(account), UPGRADE_TIMEOUT)
      if (next) nextUpgrade.delete(key)
      return next
    } catch (error) {
      nextUpgrade.set(key, now + RETRY_AFTER)
      console.warn(`[CitrusMail] JMAP not available for a mailbox yet, staying on IMAP: ${(error as Error).message}`)
      return undefined
    }
  }))).filter((item): item is AccountSettings => Boolean(item))
  if (moved.length) await saveSwitched(event, moved)
  return moved.map(item => item.email.toLowerCase())
}

/**
 * After a request failed: when it failed because JMAP is down, and the IMAP
 * server kept at sign-in answers, the mailbox moves to IMAP. True when it did
 */
export async function fallBackToImap(event: RequestEvent, account: AccountSettings, error: unknown): Promise<boolean> {
  const imap = account.imapFallback
  if (account.incoming.protocol !== 'jmap' || !imap || account.oauth || !isOutage(error)) return false
  const key = accountKey(account)
  if (Date.now() - (lastOutageCheck.get(key) ?? 0) < CHECK_EVERY) return false
  lastOutageCheck.set(key, Date.now())
  // One failed request isn't an outage: JMAP is asked again, afresh
  try {
    await withDeadline(verifyJmap(account), UPGRADE_TIMEOUT)
    return false
  } catch (again) {
    if (!isOutage(again)) return false
  }
  const next: AccountSettings = { ...account, incoming: imap, imapFallback: undefined }
  try {
    await verifyImap(next)
  } catch {
    return false
  }
  console.warn('[CitrusMail] JMAP is down for a mailbox; it reads over IMAP until JMAP is back')
  // The reload that follows doesn't wait on JMAP again; a start after the retry time does
  nextUpgrade.set(accountKey(next), Date.now() + RETRY_AFTER)
  await saveSwitched(event, [next])
  return true
}
