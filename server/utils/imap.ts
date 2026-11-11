import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash } from 'node:crypto'
import { ImapFlow } from 'imapflow'
import type { ImapFlowOptions } from 'imapflow'

// Kept open a while after the last request: logging in again costs seconds on a slow server
const IDLE_CLOSE = 5 * 60_000
/** Errors after which the connection is gone and one retry on a fresh one is safe */
const DEAD = new Set(['NoConnection', 'EConnectionClosed', 'StateLogout', 'ETIMEOUT', 'ECONNRESET', 'EPIPE'])

interface Pooled {
  client: ImapFlow
  ready: Promise<ImapFlow>
  users: number
  timer?: ReturnType<typeof setTimeout>
}

const pool = new Map<string, Pooled>()

/**
 * Two connections per account: one for what you're looking at (the list, a
 * message) and one for work in the background (rules, new-mail checks,
 * settings sync, push, the outbox). A mail server answers one command at a
 * time per connection, so without this a rules pass would hold up opening
 * a folder by seconds
 */
const lane = new AsyncLocalStorage<'background'>()

/** Runs `fn` with its mail commands on the account's background connection */
export function inBackground<T>(fn: () => Promise<T>): Promise<T> {
  return lane.run('background', fn)
}

export function accountKey(account: AccountSettings): string {
  const { email, username, password, incoming } = account
  // A refreshed access token must land on the same pooled connection, which stays logged in
  const credential = account.oauth ? `oauth:${account.oauth.secret}` : password
  return createHash('sha256').update([email, username, credential, incoming.host, incoming.port].join('\0')).digest('hex').slice(0, 32)
}

/** `target` is the checked address from connectTarget(), so DNS can't change it */
export function imapOptions(account: AccountSettings, target: { address: string, servername?: string }): ImapFlowOptions {
  const { incoming } = account
  return {
    host: target.address,
    servername: target.servername,
    port: incoming.port,
    secure: incoming.security === 'tls',
    doSTARTTLS: incoming.security === 'tls' ? undefined : incoming.security === 'starttls',
    auth: account.oauth
      ? { user: account.username || account.email, accessToken: account.oauth.accessToken }
      : { user: account.username || account.email, pass: account.password },
    tls: isLoopback(incoming.host) ? { rejectUnauthorized: false } : undefined,
    logger: false,
    disableAutoIdle: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 120_000
  }
}

/** Connects, logs in and logs out: used to check settings before a session is created */
export async function verifyImap(account: AccountSettings) {
  const target = await connectTarget(account.incoming.host)
  const client = new ImapFlow({ ...imapOptions(account, target), connectionTimeout: 8000, greetingTimeout: 8000 })
  client.on('error', () => {})
  try {
    await client.connect()
    await client.logout()
  } finally {
    client.close()
  }
}

function open(key: string, account: AccountSettings, target: { address: string, servername?: string }): Pooled {
  const client = new ImapFlow(imapOptions(account, target))
  const entry: Pooled = { client, users: 0, ready: client.connect().then(() => client) }
  const drop = () => {
    if (pool.get(key) === entry) pool.delete(key)
  }
  // An unhandled 'error' event would crash the process
  client.on('error', drop)
  client.on('close', drop)
  entry.ready.catch(drop)
  pool.set(key, entry)
  return entry
}

function acquire(account: AccountSettings, target: { address: string, servername?: string }): Pooled {
  const key = lane.getStore() ? `${accountKey(account)}:background` : accountKey(account)
  let entry = pool.get(key)
  // `usable` is false while connecting too, so only judge connections that are up
  if (entry && entry.client.authenticated && !entry.client.usable) {
    pool.delete(key)
    entry.client.close()
    entry = undefined
  }
  entry ??= open(key, account, target)
  clearTimeout(entry.timer)
  entry.users++
  return entry
}

function release(entry: Pooled) {
  entry.users--
  if (entry.users > 0) return
  entry.timer = setTimeout(() => {
    for (const [key, value] of pool) {
      if (value === entry) pool.delete(key)
    }
    entry.client.logout().catch(() => entry.client.close())
  }, IDLE_CLOSE)
  entry.timer.unref?.()
}

/** Runs `fn` on the account's pooled connection, reconnecting once if it had died */
export async function withImap<T>(account: AccountSettings, fn: (client: ImapFlow) => Promise<T>, retry = true): Promise<T> {
  const entry = acquire(account, await connectTarget(account.incoming.host))
  try {
    return await fn(await entry.ready)
  } catch (error) {
    const code = (error as { code?: string }).code ?? ''
    const dead = DEAD.has(code) || (entry.client.authenticated && !entry.client.usable)
    if (retry && dead) {
      entry.client.close()
      return withImap(account, fn, false)
    }
    throw error
  } finally {
    release(entry)
  }
}

/**
 * Runs `fn` with `path` selected. imapflow queues mailbox locks per connection,
 * so concurrent requests for different folders take turns instead of clashing.
 */
export function withMailbox<T>(account: AccountSettings, path: string, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
  return withImap(account, async (client) => {
    const lock = await client.getMailboxLock(path, { acquireTimeout: 30_000 })
    try {
      return await fn(client)
    } finally {
      lock.release()
    }
  })
}
