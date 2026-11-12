import { lookup, promises as dnsPromises } from 'node:dns'
import net from 'node:net'
import { createError, useRuntimeConfig } from 'nuxt/server'
import { Agent, fetch as undiciFetch } from 'undici'

/**
 * Keeps the server from being used to reach places only it can reach: the
 * machine itself, the local network, cloud metadata endpoints. Every mail
 * and DAV connection resolves its host once, checks every address, and then
 * connects to that exact address, so DNS can't swap in another one in between.
 *
 * Private addresses are allowed in the Mac app (a mail server on your own
 * network, Proton Mail Bridge on this Mac), in development, and when
 * NUXT_MAIL_ALLOW_PRIVATE_HOSTS=true for self-hosters whose server is internal.
 * Discovery never follows a domain's DNS or autoconfig to a private address.
 */
// Two lists: Node's BlockList matches IPv4 addresses against IPv6 subnets
// (as ::ffff:a.b.c.d), so one shared list made every IPv4 address look private
const blockedV4 = new net.BlockList()
const blockedV6 = new net.BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
] as const) blockedV4.addSubnet(address, prefix, 'ipv4')
for (const [address, prefix] of [
  ['::', 128], ['::1', 128], ['::ffff:0:0', 96], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64],
  ['2001::', 32], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]
] as const) blockedV6.addSubnet(address, prefix, 'ipv6')

export function isPrivateAddress(ip: string): boolean {
  const address = ip.replace(/^\[|\]$/g, '').split('%')[0]!
  if (net.isIPv4(address)) return blockedV4.check(address, 'ipv4')
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return blockedV4.check(mapped[1]!, 'ipv4')
  return net.isIPv6(address) ? blockedV6.check(address, 'ipv6') : true
}

/** A loopback server (Proton Mail Bridge) may use a self-signed certificate */
export function isLoopback(host: string): boolean {
  const bare = host.replace(/^\[|\]$/g, '')
  return bare === 'localhost' || bare === '::1' || (net.isIPv4(bare) && bare.startsWith('127.'))
}

export function privateHostsAllowed(): boolean {
  if (import.meta.dev || process.env.CITRUSMAIL_DESKTOP === '1') return true
  const value = (useRuntimeConfig().mail as { allowPrivateHosts?: unknown }).allowPrivateHosts
  return value === true || value === 'true'
}

export class BlockedHostError extends Error {
  code = 'EBLOCKEDHOST'
  constructor(host: string) {
    super(`${host} is on a private network, which this server doesn't connect to`)
  }
}

/** The one address to connect to for `host`, or BlockedHostError */
export async function resolveHost(host: string, allowPrivate = privateHostsAllowed()): Promise<string> {
  const bare = host.replace(/^\[|\]$/g, '')
  const addresses = net.isIP(bare)
    ? [bare]
    : (await dnsPromises.lookup(bare, { all: true, verbatim: true })).map(a => a.address)
  if (!addresses.length) throw Object.assign(new Error(`Couldn't find ${host}`), { code: 'ENOTFOUND' })
  if (!allowPrivate && addresses.some(isPrivateAddress)) throw new BlockedHostError(host)
  return addresses[0]!
}

/** Where to connect and which name to verify the certificate against */
export async function connectTarget(host: string, allowPrivate = privateHostsAllowed()) {
  const address = await resolveHost(host, allowPrivate)
  const bare = host.replace(/^\[|\]$/g, '')
  return { address, servername: net.isIP(bare) ? undefined : bare }
}

/** A dns.lookup that refuses private answers, for HTTP connections */
function guardedLookup(allowPrivate: boolean): net.LookupFunction {
  return (hostname, options, callback) => {
    lookup(hostname, { ...options, all: true, verbatim: true }, (error, addresses) => {
      if (error) return callback(error, '', 4)
      const list = addresses as unknown as { address: string, family: number }[]
      if (!allowPrivate && list.some(a => isPrivateAddress(a.address))) {
        return callback(new BlockedHostError(hostname) as unknown as NodeJS.ErrnoException, '', 4)
      }
      if (options.all) return (callback as unknown as (e: null, a: typeof list) => void)(null, list)
      callback(null, list[0]!.address, list[0]!.family)
    })
  }
}

const agents = new Map<boolean, Agent>()
function agentFor(allowPrivate: boolean) {
  let agent = agents.get(allowPrivate)
  if (!agent) {
    // Connections stay open between clicks: a mail server across the internet
    // otherwise costs a new TLS handshake whenever you pause for a few seconds
    agent = new Agent({ connect: { lookup: guardedLookup(allowPrivate) }, keepAliveTimeout: 60_000, keepAliveMaxTimeout: 10 * 60_000 })
    agents.set(allowPrivate, agent)
  }
  return agent
}

/**
 * fetch() that checks every connection it opens (redirects included). A URL
 * with a literal IP never reaches a lookup, so it is checked here first.
 */
export function guardedFetch(allowPrivate = privateHostsAllowed(), timeout = 20_000): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('Only http and https URLs are allowed')
    const host = url.hostname.replace(/^\[|\]$/g, '')
    if (!allowPrivate && net.isIP(host) && isPrivateAddress(host)) throw new BlockedHostError(host)
    const redirect = init?.redirect ?? 'follow'
    // Follow redirects by hand so a literal private IP in a Location is caught too
    let current = url
    let headers = init?.headers
    for (let hop = 0; hop < 5; hop++) {
      const res = await undiciFetch(current, {
        ...(init as object),
        headers,
        redirect: 'manual',
        dispatcher: agentFor(allowPrivate),
        signal: init?.signal ?? AbortSignal.timeout(timeout)
      } as Parameters<typeof undiciFetch>[1])
      const location = res.headers.get('location')
      if (redirect !== 'follow' || res.status < 300 || res.status > 399 || !location) {
        Object.defineProperty(res, 'url', { value: current.toString() })
        return res as unknown as Response
      }
      await res.body?.cancel()
      const origin = current.origin
      current = new URL(location, current)
      // As fetch does on its own: another site never gets this one's credentials
      if (current.origin !== origin && headers) {
        const rest = new Headers(headers)
        rest.delete('authorization')
        rest.delete('cookie')
        rest.delete('proxy-authorization')
        headers = Object.fromEntries(rest)
      }
      const next = current.hostname.replace(/^\[|\]$/g, '')
      if (!['http:', 'https:'].includes(current.protocol)) throw new TypeError('Redirect to a non-http URL')
      if (!allowPrivate && net.isIP(next) && isPrivateAddress(next)) throw new BlockedHostError(next)
    }
    throw new Error('Too many redirects')
  }) as typeof fetch
}

/** Reads at most `limit` bytes of a response body as text, or undefined if larger */
export async function readLimited(res: Response, limit: number): Promise<string | undefined> {
  return (await readLimitedBytes(res, limit))?.toString('utf8')
}

/** Reads at most `limit` bytes of a response body, or undefined if larger */
export async function readLimitedBytes(res: Response, limit: number): Promise<Buffer | undefined> {
  const reader = res.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel()
      return undefined
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

export function blockedHostError(host: string) {
  return createError({ status: 400, message: `${host} is on a private network, which this server doesn't connect to.` })
}
