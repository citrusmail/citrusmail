import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto'
import { useRuntimeConfig } from 'nuxt/server'

/**
 * Encryption for the few secrets the server has to keep between requests:
 * messages waiting to be sent later (they carry the account to send them
 * with), push subscriptions and AI keys. The key mixes the app secret, which
 * lives in the environment, with a random key kept in storage, so neither the
 * disk nor the environment alone opens anything
 */
let cached: Buffer | undefined

async function vaultKey(): Promise<Buffer> {
  if (cached) return cached
  const storage = useStorage('letterbox')
  let local = await storage.getItem<string>('vault:key')
  if (!local) {
    local = randomBytes(32).toString('hex')
    await storage.setItem('vault:key', local)
  }
  const secret = String((useRuntimeConfig() as { appSecret?: string }).appSecret ?? '')
  cached = createHash('sha256').update(`${secret}\0${local}`).digest()
  return cached
}

function encrypt(key: Buffer, value: unknown): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')
}

function decrypt<T>(key: Buffer, sealed: string): T {
  const raw = Buffer.from(sealed, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12))
  decipher.setAuthTag(raw.subarray(12, 28))
  return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')) as T
}

export async function sealValue(value: unknown): Promise<string> {
  return encrypt(await vaultKey(), value)
}

export async function unsealValue<T>(sealed: string): Promise<T> {
  return decrypt<T>(await vaultKey(), sealed)
}

/**
 * A key only the mailbox's owner can make: from the mail password. Secrets
 * synced through the mailbox (AI keys) are locked with it, so another device
 * signed in to the same mailbox can open them and the mail server can't
 */
function passwordKey(account: AccountSettings): Buffer {
  return scryptSync(account.password, `citrusmail\0${account.email.toLowerCase()}`, 32)
}

export function sealForOwner(account: AccountSettings, value: unknown): string {
  return encrypt(passwordKey(account), value)
}

export function unsealForOwner<T>(account: AccountSettings, sealed: string): T | undefined {
  try {
    return decrypt<T>(passwordKey(account), sealed)
  } catch {
    // The password changed since: the secrets have to be entered again
    return undefined
  }
}
