import { createHash } from 'node:crypto'

/**
 * The few things CitrusMail remembers per account (signature, rules, sender
 * lists, the background picture), keyed by address and server so a password
 * change keeps them. They stay on this device: nothing is kept in the
 * mailbox (see sync.ts for why the old settings folder was retired)
 */
/** The folder an account's files live under, also kept by a tracking image to find its way back */
export function storeId(account: AccountSettings) {
  return createHash('sha256').update(`${account.email.toLowerCase()}\0${signedInHost(account.incoming).toLowerCase()}`).digest('hex').slice(0, 32)
}

/**
 * The server the account actually signed in to. For JMAP with a session URL
 * that's the URL's host, never the host field beside it: otherwise anyone
 * could sign in on their own JMAP server, name someone else's host, and get
 * their stored data. Sign-in sets the two the same, so this only differs for
 * a session made before it did
 */
function signedInHost(incoming: AccountSettings['incoming']): string {
  if (incoming.protocol !== 'jmap' || !incoming.url) return incoming.host
  try {
    return new URL(incoming.url).hostname.replace(/^\[|\]$/g, '')
  } catch {
    // Can't be signed in to; nobody's data is filed under an empty host
    return ''
  }
}

function storeKey(account: AccountSettings, name: string) {
  return `${storeId(account)}:${name}.json`
}

export async function readLocal<T>(account: AccountSettings, name: string): Promise<T | null> {
  return useStorage('citrusmail').getItem<T>(storeKey(account, name))
}

export async function writeLocal<T>(account: AccountSettings, name: string, value: T): Promise<void> {
  await useStorage('citrusmail').setItem(storeKey(account, name), value as never)
}

export async function removeLocal(account: AccountSettings, name: string): Promise<void> {
  await useStorage('citrusmail').removeItem(storeKey(account, name))
}

export async function readStore<T>(account: AccountSettings, name: string, fallback: T): Promise<T> {
  retireSyncFolder(account)
  const value = await readLocal<T>(account, name)
  return value ?? fallback
}

export async function writeStore<T>(account: AccountSettings, name: string, value: T): Promise<void> {
  await writeLocal(account, name, value)
}

export const DEFAULT_SETTINGS: UserSettings = { signature: '', signatureMode: 'rich', signatureOnReplies: true }
