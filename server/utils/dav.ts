import { createHash } from 'node:crypto'
import { DAVClient } from 'tsdav'
import type { DAVAddressBook, DAVCalendar } from 'tsdav'
import { createError, getRequestHeader, isNuxtError } from 'nuxt/server'
import type { RequestEvent } from 'nuxt/server'
import { isValidZone } from './tz'

type Kind = 'caldav' | 'carddav'

export interface DavSession<T extends { url: string }> {
  client: DAVClient
  collections: T[]
  host: string
  kind: Kind
}

// Discovery costs several round trips, so a logged-in client and its
// collection list are reused for a short while. Purely a cache: a cold
// serverless instance just discovers again
const TTL = 2 * 60 * 1000
const MAX_ENTRIES = 200
const TIMEOUT = 20000

const cache = new Map<string, { expires: number, session: Promise<DavSession<{ url: string }>> }>()

// Every DAV request goes through the network guard (redirects too), so a
// calendar URL can't point the server at the local network
const timedFetch: typeof fetch = (input, init) => guardedFetch(privateHostsAllowed(), TIMEOUT)(input, { ...init, signal: AbortSignal.timeout(TIMEOUT) })

export const encodeId = (url: string) => Buffer.from(url).toString('base64url')
export const decodeId = (id: string) => Buffer.from(id, 'base64url').toString()

export function viewerZone(event: RequestEvent): string {
  const zone = getRequestHeader(event, 'x-timezone')

  return zone && isValidZone(zone) ? zone : 'UTC'
}

const label = (kind: Kind) => kind === 'caldav' ? 'calendar' : 'contacts'

function upstreamStatus(message: string): number | undefined {
  if (/Invalid credentials|Unauthorized/i.test(message)) {
    return 401
  }
  const status = message.match(/\b([45]\d\d)\b/)

  return status ? Number(status[1]) : undefined
}

/** Maps a tsdav / fetch failure to a message a person can act on */
export function davError(error: unknown, host: string, kind: Kind): Error {
  if (isNuxtError(error)) {
    return error
  }

  const message = error instanceof Error ? error.message : String(error)
  const name = error instanceof Error ? error.name : ''
  if ((error as { code?: string })?.code === 'EBLOCKEDHOST' || (error as { cause?: { code?: string } })?.cause?.code === 'EBLOCKEDHOST') {
    return createError({ status: 400, message: `${host} is on a private network, which this server doesn't connect to` })
  }
  if (name === 'TimeoutError' || name === 'AbortError' || /fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|certificate/i.test(`${message} ${String((error as { cause?: unknown })?.cause ?? '')}`)) {
    return createError({ status: 502, message: `Couldn't reach ${host}` })
  }

  const status = upstreamStatus(message)
  if (status === 401 || status === 403) {
    // `auth` tells it apart from our own session expiring, as the mail routes do
    return createError({ status: 401, message: `The ${label(kind)} server rejected the password`, data: { auth: true } })
  }

  return createError({ status: 502, message: `The ${label(kind)} server at ${host} failed${status ? ` (${status})` : ''}` })
}

export function statusError(status: number, host: string, kind: Kind): Error {
  if (status === 412) {
    return createError({ status: 409, message: 'This item changed on the server, reload and try again' })
  }

  return davError(new Error(`HTTP ${status}`), host, kind)
}

function serverUrlOf(account: AccountSettings, kind: Kind): string | undefined {
  return (kind === 'caldav' ? account.caldav : account.carddav)?.trim() || undefined
}

async function connect(account: AccountSettings, kind: Kind, serverUrl: string): Promise<DavSession<{ url: string }>> {
  let host: string
  try {
    host = new URL(serverUrl).host
  } catch {
    throw createError({ status: 409, message: `The ${label(kind)} server address is not a valid URL` })
  }
  const client = new DAVClient({
    serverUrl,
    credentials: { username: account.username || account.email, password: account.password },
    authMethod: 'Basic',
    defaultAccountType: kind,
    fetch: timedFetch
  })

  try {
    await client.login()
    const collections = kind === 'caldav'
      ? (await client.fetchCalendars()).filter(calendar => !calendar.components?.length || calendar.components.includes('VEVENT'))
      : await client.fetchAddressBooks()

    return { client, collections, host, kind }
  } catch (error) {
    throw davError(error, host, kind)
  }
}

function prune(now: number) {
  for (const [key, entry] of cache) {
    if (entry.expires <= now || cache.size > MAX_ENTRIES) {
      cache.delete(key)
    }
  }
}

/** null when the account has no server of that kind */
async function useDav<T extends { url: string }>(account: AccountSettings, kind: Kind): Promise<DavSession<T> | null> {
  const serverUrl = serverUrlOf(account, kind)
  if (!serverUrl) {
    return null
  }

  const username = account.username || account.email
  const key = [kind, serverUrl, username, createHash('sha256').update(account.password).digest('base64url')].join('\n')
  const now = Date.now()
  prune(now)

  let entry = cache.get(key)
  if (!entry || entry.expires <= now) {
    entry = { expires: now + TTL, session: connect(account, kind, serverUrl) }
    cache.set(key, entry)
    // A failed login is not worth remembering
    entry.session.catch(() => cache.delete(key))
  }

  return await entry.session as DavSession<T>
}

export const useCalDav = (account: AccountSettings) => useDav<DAVCalendar>(account, 'caldav')
export const useCardDav = (account: AccountSettings) => useDav<DAVAddressBook>(account, 'carddav')

export function notSetUp(kind: Kind): Error {
  return createError({ status: 409, message: kind === 'caldav' ? 'Calendar is not set up for this account' : 'Contacts are not set up for this account' })
}

/** A collection of this account by id; never trusts a URL from the client */
export function findCollection<T extends { url: string }>(session: DavSession<T>, id: string): T {
  const url = decodeId(id)
  const collection = session.collections.find(candidate => candidate.url === url)
  if (!collection) {
    throw createError({ status: 404, message: session.kind === 'caldav' ? 'Calendar not found' : 'Address book not found' })
  }

  return collection
}

/** The collection an object URL sits in, so object ids are checked too */
export function collectionOf<T extends { url: string }>(session: DavSession<T>, url: string): T {
  const collection = session.collections.find(candidate => url.startsWith(candidate.url) && !url.slice(candidate.url.length).includes('/'))
  if (!collection) {
    throw createError({ status: 404, message: 'Not found' })
  }

  return collection
}

export function objectUrl(collection: { url: string }, basename: string, extension: string): string {
  return `${collection.url.replace(/\/?$/, '/')}${encodeURIComponent(basename)}${extension}`
}

export function displayName(collection: { displayName?: string | Record<string, unknown>, url: string }): string {
  if (typeof collection.displayName === 'string' && collection.displayName.trim()) {
    return collection.displayName.trim()
  }

  return decodeURIComponent(collection.url.replace(/\/+$/, '').split('/').pop() || 'Calendar')
}

/** Plain GET with the client's credentials; null when the object is gone */
export async function getObject(session: DavSession<{ url: string }>, url: string): Promise<{ url: string, data: string, etag?: string } | null> {
  let response: Response
  try {
    response = await timedFetch(url, { headers: { ...session.client.authHeaders } })
  } catch (error) {
    throw davError(error, session.host, session.kind)
  }

  if (response.status === 404 || response.status === 410) {
    return null
  }
  if (!response.ok) {
    throw statusError(response.status, session.host, session.kind)
  }

  return { url, data: await response.text(), etag: response.headers.get('etag') ?? undefined }
}

const CONTENT_TYPES: Record<Kind, string> = {
  caldav: 'text/calendar; charset=utf-8',
  carddav: 'text/vcard; charset=utf-8'
}

/** PUT; `etag` guards an update, its absence makes it create-only */
export async function putObject(session: DavSession<{ url: string }>, url: string, data: string, etag?: string): Promise<void> {
  let response: Response
  try {
    response = await session.client.updateObject({
      url,
      data,
      etag,
      headers: { 'content-type': CONTENT_TYPES[session.kind], ...(etag ? {} : { 'if-none-match': '*' }) }
    })
  } catch (error) {
    throw davError(error, session.host, session.kind)
  }

  if (!response.ok) {
    throw statusError(response.status, session.host, session.kind)
  }
}

/** Idempotent: an object already gone is fine */
export async function deleteObject(session: DavSession<{ url: string }>, url: string, etag?: string): Promise<void> {
  let response: Response
  try {
    response = await session.client.deleteObject({ url, etag })
  } catch (error) {
    throw davError(error, session.host, session.kind)
  }

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw statusError(response.status, session.host, session.kind)
  }
}
