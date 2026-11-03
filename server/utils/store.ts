import { createHash } from 'node:crypto'

/**
 * The few things CitrusMail remembers per account (signature, rules, sender
 * lists, the background picture), keyed by address and server so a password
 * change keeps them. The ones in SYNCED also travel through the mailbox
 * itself (see sync.ts), so they follow you to every device you sign in on
 */
/** The folder an account's files live under, also kept by a tracking image to find its way back */
export function storeId(account: AccountSettings) {
  return createHash('sha256').update(`${account.email.toLowerCase()}\0${account.incoming.host.toLowerCase()}`).digest('hex').slice(0, 32)
}

function storeKey(account: AccountSettings, name: string) {
  return `${storeId(account)}:${name}.json`
}

export const SYNCED = ['settings', 'senders', 'rules', 'background', 'ai'] as const
export type SyncedName = (typeof SYNCED)[number]
const isSynced = (name: string): name is SyncedName => (SYNCED as readonly string[]).includes(name)

/** When each synced store last changed, by name */
export type SyncMeta = Partial<Record<SyncedName, number>>

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
  if (isSynced(name)) await pullSettings(account)
  const value = await readLocal<T>(account, name)
  return value ?? fallback
}

export async function writeStore<T>(account: AccountSettings, name: string, value: T): Promise<void> {
  await writeLocal(account, name, value)
  if (!isSynced(name)) return
  const meta = await readLocal<SyncMeta>(account, 'sync-meta') ?? {}
  meta[name] = Date.now()
  await writeLocal(account, 'sync-meta', meta)
  pushSettings(account)
}

export const DEFAULT_SETTINGS: UserSettings = { signature: '', signatureMode: 'rich', signatureOnReplies: true }
