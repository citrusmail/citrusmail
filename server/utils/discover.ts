import { Resolver } from 'node:dns/promises'
import net from 'node:net'
import tls from 'node:tls'

type Incoming = AccountSettings['incoming']

const TIMEOUT = 3000
const CACHE_TTL = 10 * 60 * 1000
const cache = new Map<string, { at: number, result: DiscoveryResult }>()

const dns = new Resolver({ timeout: TIMEOUT, tries: 1 })

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

interface Preset extends Omit<DiscoveryResult, 'source'> {
  domains: string[]
  /** MX host suffixes that mean a custom domain is hosted here */
  mx?: string[]
}

const imap = (host: string, port = 993, security: Security = 'tls'): Incoming => ({ protocol: 'imap', host, port, security })
const smtp = (host: string, port = 465, security: Security = 'tls'): ServerSettings => ({ host, port, security })

const PRESETS: Preset[] = [
  {
    provider: 'Gmail',
    icon: 'i-simple-icons-gmail',
    appPasswordUrl: 'https://myaccount.google.com/apppasswords',
    domains: ['gmail.com', 'googlemail.com'],
    mx: ['google.com', 'googlemail.com'],
    incoming: imap('imap.gmail.com'),
    outgoing: smtp('smtp.gmail.com'),
    caldav: 'https://apidata.googleusercontent.com/caldav/v2/',
    carddav: 'https://www.googleapis.com/carddav/v1/principals/'
  },
  {
    provider: 'Outlook',
    icon: 'i-simple-icons-microsoftoutlook',
    domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'outlook.fr', 'outlook.de', 'hotmail.co.uk', 'hotmail.fr', 'live.co.uk'],
    mx: ['mail.protection.outlook.com', 'olc.protection.outlook.com'],
    incoming: imap('outlook.office365.com'),
    outgoing: smtp('smtp.office365.com', 587, 'starttls')
  },
  {
    provider: 'iCloud',
    icon: 'i-simple-icons-icloud',
    appPasswordUrl: 'https://account.apple.com/account/manage',
    domains: ['icloud.com', 'me.com', 'mac.com'],
    mx: ['mail.icloud.com'],
    incoming: imap('imap.mail.me.com'),
    outgoing: smtp('smtp.mail.me.com', 587, 'starttls'),
    caldav: 'https://caldav.icloud.com',
    carddav: 'https://contacts.icloud.com'
  },
  {
    provider: 'Yahoo',
    icon: 'i-simple-icons-yahoo',
    appPasswordUrl: 'https://login.yahoo.com/account/security',
    domains: ['yahoo.com', 'ymail.com', 'rocketmail.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de', 'yahoo.co.jp', 'yahoo.ca', 'yahoo.com.au'],
    mx: ['yahoodns.net'],
    incoming: imap('imap.mail.yahoo.com'),
    outgoing: smtp('smtp.mail.yahoo.com'),
    caldav: 'https://caldav.calendar.yahoo.com',
    carddav: 'https://carddav.address.yahoo.com'
  },
  {
    provider: 'AOL',
    icon: 'i-simple-icons-aol',
    appPasswordUrl: 'https://login.aol.com/account/security',
    domains: ['aol.com', 'aim.com'],
    incoming: imap('imap.aol.com'),
    outgoing: smtp('smtp.aol.com')
  },
  {
    provider: 'Fastmail',
    appPasswordUrl: 'https://app.fastmail.com/settings/security/apps',
    domains: ['fastmail.com', 'fastmail.fm', 'fastmail.net', 'fastmail.org', 'fastmail.us', 'fastmail.cn', 'sent.com', 'messagingengine.com'],
    mx: ['messagingengine.com'],
    incoming: imap('imap.fastmail.com'),
    outgoing: smtp('smtp.fastmail.com'),
    caldav: 'https://caldav.fastmail.com',
    carddav: 'https://carddav.fastmail.com'
  },
  {
    provider: 'Zoho Mail',
    icon: 'i-simple-icons-zoho',
    domains: ['zoho.com', 'zohomail.com'],
    mx: ['zoho.com'],
    incoming: imap('imap.zoho.com'),
    outgoing: smtp('smtp.zoho.com')
  },
  {
    provider: 'GMX',
    icon: 'i-simple-icons-gmx',
    domains: ['gmx.net', 'gmx.de', 'gmx.at', 'gmx.ch'],
    incoming: imap('imap.gmx.net'),
    outgoing: smtp('mail.gmx.net', 587, 'starttls')
  },
  {
    provider: 'GMX',
    icon: 'i-simple-icons-gmx',
    domains: ['gmx.com', 'gmx.us', 'gmx.co.uk', 'gmx.fr'],
    incoming: imap('imap.gmx.com'),
    outgoing: smtp('mail.gmx.com', 587, 'starttls')
  },
  {
    provider: 'mail.com',
    icon: 'i-simple-icons-maildotcom',
    domains: ['mail.com', 'email.com', 'usa.com', 'post.com'],
    incoming: imap('imap.mail.com'),
    outgoing: smtp('smtp.mail.com', 587, 'starttls')
  },
  {
    provider: 'Proton Mail',
    icon: 'i-simple-icons-protonmail',
    note: 'Proton Mail works through Proton Mail Bridge, running on the same machine as this app. Use the password Bridge shows, not your Proton password.',
    domains: ['proton.me', 'protonmail.com', 'protonmail.ch', 'pm.me'],
    mx: ['protonmail.ch'],
    incoming: imap('127.0.0.1', 1143, 'starttls'),
    outgoing: smtp('127.0.0.1', 1025, 'starttls')
  },
  {
    provider: 'Yandex Mail',
    appPasswordUrl: 'https://id.yandex.com/security/app-passwords',
    domains: ['yandex.com', 'yandex.ru', 'ya.ru', 'yandex.ua', 'yandex.by', 'yandex.kz'],
    mx: ['yandex.net', 'yandex.ru'],
    incoming: imap('imap.yandex.com'),
    outgoing: smtp('smtp.yandex.com'),
    caldav: 'https://caldav.yandex.ru',
    carddav: 'https://carddav.yandex.ru'
  }
]

function fromPreset(preset: Preset, source: string): DiscoveryResult {
  const { domains: _domains, mx: _mx, ...result } = preset
  return { ...result, source }
}

function presetForDomain(domain: string) {
  return PRESETS.find(p => p.domains.includes(domain))
}

function presetForMx(mxHost: string) {
  return PRESETS.find(p => p.mx?.some(suffix => mxHost === suffix || mxHost.endsWith(`.${suffix}`)))
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function withTimeout<T>(promise: Promise<T>, ms = TIMEOUT): Promise<T | undefined> {
  return Promise.race([
    promise.catch(() => undefined),
    new Promise<undefined>(resolve => setTimeout(resolve, ms))
  ])
}

/** Autoconfig files are a few KB; anything far bigger isn't one */
const MAX_AUTOCONFIG = 64 * 1024

async function fetchText(url: string): Promise<string | undefined> {
  // Discovery never reaches private addresses, even in the Mac app
  const res = await guardedFetch(false, TIMEOUT)(url)
  if (!res.ok) {
    await res.body?.cancel()
    return undefined
  }
  const text = await readLimited(res, MAX_AUTOCONFIG)
  return text?.includes('<clientConfig') ? text : undefined
}

/** aspmx.l.google.com → google.com, mx.example.co.uk → example.co.uk */
function baseDomain(host: string): string {
  const parts = host.toLowerCase().replace(/\.$/, '').split('.')
  const secondLevel = ['co', 'com', 'net', 'org', 'ac', 'gov', 'edu', 'ne', 'or']
  const keep = parts.length > 2 && parts.at(-1)!.length === 2 && secondLevel.includes(parts.at(-2)!) ? 3 : 2
  return parts.slice(-keep).join('.')
}

/** Port and security follow each other: 993/995/465 are implicit TLS */
export function defaultSecurity(port: number): Security {
  return [993, 995, 465].includes(port) ? 'tls' : 'starttls'
}

/* ------------------------------------------------------------------ */
/* Thunderbird autoconfig / ISPDB                                      */
/* ------------------------------------------------------------------ */

function tag(block: string, name: string) {
  // No overlapping quantifiers, so a hostile file can't make this slow
  return block.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1]?.trim()
}

function parseServers(xml: string, kind: 'incomingServer' | 'outgoingServer') {
  const blocks = [...xml.matchAll(new RegExp(`<${kind}\\s+type="(\\w+)"[^>]*>([\\s\\S]*?)</${kind}>`, 'g'))]
  return blocks.map(([, type, body]) => {
    const socket = tag(body!, 'socketType')?.toUpperCase()
    const security: Security = socket === 'SSL' ? 'tls' : socket === 'STARTTLS' ? 'starttls' : 'none'
    return {
      type: type!.toLowerCase(),
      host: tag(body!, 'hostname') ?? '',
      port: Number(tag(body!, 'port')),
      security,
      username: tag(body!, 'username')
    }
    // A plain-text server would get the password in the clear: only the
    // person can choose that, in Advanced
  }).filter(s => s.host && s.port && s.security !== 'none')
}

const rank = (s: { type: string, security: Security }, types: string[]) =>
  types.indexOf(s.type) * 3 + ['tls', 'starttls', 'none'].indexOf(s.security)

function parseAutoconfig(xml: string, email: string): Omit<DiscoveryResult, 'source'> | undefined {
  const [local, domain] = email.split('@') as [string, string]
  const fill = (value: string) => value
    .replaceAll('%EMAILADDRESS%', email)
    .replaceAll('%EMAILLOCALPART%', local)
    .replaceAll('%EMAILDOMAIN%', domain)

  const incoming = parseServers(xml, 'incomingServer')
    .filter(s => s.type === 'imap' || s.type === 'pop3')
    .sort((a, b) => rank(a, ['imap', 'pop3']) - rank(b, ['imap', 'pop3']))[0]
  const outgoing = parseServers(xml, 'outgoingServer')
    .filter(s => s.type === 'smtp')
    .sort((a, b) => rank(a, ['smtp']) - rank(b, ['smtp']))[0]
  if (!incoming || !outgoing) return undefined

  const username = incoming.username ? fill(incoming.username) : undefined
  return {
    provider: tag(xml, 'displayShortName') || tag(xml, 'displayName'),
    incoming: { protocol: incoming.type as 'imap' | 'pop3', host: fill(incoming.host), port: incoming.port, security: incoming.security },
    outgoing: { host: fill(outgoing.host), port: outgoing.port, security: outgoing.security },
    username: username && username.toLowerCase() !== email.toLowerCase() ? username : undefined
  }
}

async function autoconfig(url: string, email: string) {
  const xml = await fetchText(url)
  return xml ? parseAutoconfig(xml, email) : undefined
}

/* ------------------------------------------------------------------ */
/* DNS                                                                 */
/* ------------------------------------------------------------------ */

async function srv(name: string) {
  const records = await dns.resolveSrv(name)
  const best = records.sort((a, b) => a.priority - b.priority || b.weight - a.weight)[0]
  if (!best || best.name === '.' || best.name === '') return undefined
  return { host: best.name.replace(/\.$/, ''), port: best.port }
}

async function srvDav(domain: string, service: 'caldavs' | 'carddavs') {
  const record = await srv(`_${service}._tcp.${domain}`)
  if (!record) return undefined
  const txt = await withTimeout(dns.resolveTxt(`_${service}._tcp.${domain}`))
  const path = txt?.flat().find(t => t.startsWith('path='))?.slice(5) ?? '/'
  const port = record.port === 443 ? '' : `:${record.port}`
  return `https://${record.host}${port}${path}`
}

async function srvMail(domain: string): Promise<Omit<DiscoveryResult, 'source'> | undefined> {
  const [imaps, imapPlain, pop3s, submissions, submission] = await Promise.all(
    ['_imaps', '_imap', '_pop3s', '_submissions', '_submission'].map(s => withTimeout(srv(`${s}._tcp.${domain}`)))
  )
  const incoming: Incoming | undefined = imaps
    ? { protocol: 'imap', ...imaps, security: 'tls' }
    : imapPlain
      ? { protocol: 'imap', ...imapPlain, security: 'starttls' }
      : pop3s ? { protocol: 'pop3', ...pop3s, security: 'tls' } : undefined
  const outgoing: ServerSettings | undefined = submissions
    ? { ...submissions, security: 'tls' }
    : submission ? { ...submission, security: 'starttls' } : undefined
  return incoming && outgoing ? { incoming, outgoing } : undefined
}

async function firstMx(domain: string) {
  const records = await dns.resolveMx(domain)
  return records.sort((a, b) => a.priority - b.priority)[0]?.exchange.toLowerCase()
}

/** A well-known DAV URL counts only when a DAV server answers PROPFIND there, not a website catch-all */
async function wellKnownDav(domain: string, service: 'caldav' | 'carddav') {
  const res = await guardedFetch(false, TIMEOUT)(`https://${domain}/.well-known/${service}`, {
    method: 'PROPFIND',
    headers: { Depth: '0' }
  })
  await res.body?.cancel()
  if (res.status !== 207 && res.status !== 401) return undefined
  // The password goes to this URL later, so it must stay on the domain's own
  // https servers: a website host redirecting elsewhere doesn't count
  const found = new URL(res.url)
  return found.protocol === 'https:' && baseDomain(found.hostname) === baseDomain(domain) ? found.toString() : undefined
}

/**
 * Many mail servers (Stalwart, Mailcow, Faivelo and others) serve CalDAV and
 * CardDAV on the mail host itself rather than on the address's domain, so
 * this looks there: the incoming host first, then the outgoing one. Each URL
 * has to stay on https and on that host's own domain, like wellKnownDav
 */
export async function davOnMailHosts(hosts: (string | undefined)[]): Promise<{ caldav?: string, carddav?: string }> {
  const names = [...new Set(hosts.map(host => host?.trim().toLowerCase()).filter((host): host is string => !!host && /[a-z]/.test(host) && !host.includes(':')))]
  let found: { caldav?: string, carddav?: string } = {}
  for (const host of names) {
    const [caldav, carddav] = await Promise.all([
      found.caldav ? undefined : withTimeout(wellKnownDav(host, 'caldav')),
      found.carddav ? undefined : withTimeout(wellKnownDav(host, 'carddav'))
    ])
    found = { caldav: found.caldav ?? caldav, carddav: found.carddav ?? carddav }
    if (found.caldav && found.carddav) break
  }
  return found
}

/* ------------------------------------------------------------------ */
/* Guessing                                                            */
/* ------------------------------------------------------------------ */

/** Opens a TLS (or plain TCP for STARTTLS ports) connection and closes it as soon as it is up */
async function probe(host: string, port: number, security: Security, ms = TIMEOUT): Promise<boolean> {
  const address = await resolveHost(host, false).catch(() => undefined)
  if (!address) return false
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      socket.destroy()
      resolve(ok)
    }
    const socket = security === 'tls'
      ? tls.connect({ host: address, port, servername: host, timeout: ms }, () => done(true))
      : net.connect({ host: address, port, timeout: ms }, () => done(true))
    socket.on('error', () => done(false))
    socket.on('timeout', () => done(false))
  })
}

async function firstReachable<T extends ServerSettings>(candidates: T[]): Promise<T | undefined> {
  const results = await Promise.all(candidates.map(c => probe(c.host, c.port, c.security)))
  return candidates[results.indexOf(true)]
}

/** Common host names, plus the MX host itself (self-hosted servers often serve IMAP there too) */
async function guess(domain: string, mx?: string): Promise<Omit<DiscoveryResult, 'source'> | undefined> {
  const hosts = [...new Set([`imap.${domain}`, `mail.${domain}`, ...(mx ? [mx] : [])])]
  const smtpHosts = [...new Set([`smtp.${domain}`, `mail.${domain}`, ...(mx ? [mx] : [])])]
  const [incoming, outgoing] = await Promise.all([
    firstReachable<Incoming>(hosts.map(host => ({ protocol: 'imap', host, port: 993, security: 'tls' }))),
    firstReachable<ServerSettings>([
      ...smtpHosts.map(host => ({ host, port: 465, security: 'tls' as const })),
      ...smtpHosts.map(host => ({ host, port: 587, security: 'starttls' as const }))
    ])
  ])
  return incoming && outgoing ? { incoming, outgoing } : undefined
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export async function discover(email: string): Promise<DiscoveryResult> {
  email = email.trim().toLowerCase()
  const hit = cache.get(email)
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.result

  let found = await run(email)
  // The presets already say where their calendars are, or that there are none
  if (found.incoming && (!found.caldav || !found.carddav) && found.source !== 'preset' && found.source !== 'mx') {
    const onHost = await davOnMailHosts([found.incoming.host, found.outgoing?.host])
    found = { ...found, caldav: found.caldav ?? onHost.caldav, carddav: found.carddav ?? onHost.carddav }
  }
  const result = await publicOnly(found)
  cache.set(email, { at: Date.now(), result })
  if (cache.size > 1000) cache.delete(cache.keys().next().value!)
  return result
}

async function run(email: string): Promise<DiscoveryResult> {
  const domain = email.split('@')[1] ?? ''
  const preset = presetForDomain(domain)
  if (preset) return fromPreset(preset, 'preset')

  const q = `emailaddress=${encodeURIComponent(email)}`
  // Everything that only needs the domain starts at once; each is capped at ~3s
  const [hosted, wellKnown, ispdb, mx, srvResult, caldavSrv, carddavSrv, caldavWk, carddavWk] = await Promise.all([
    withTimeout(autoconfig(`https://autoconfig.${domain}/mail/config-v1.1.xml?${q}`, email)),
    withTimeout(autoconfig(`https://${domain}/.well-known/autoconfig/mail/config-v1.1.xml?${q}`, email)),
    withTimeout(autoconfig(`https://autoconfig.thunderbird.net/v1.1/${domain}`, email)),
    withTimeout(firstMx(domain)),
    withTimeout(srvMail(domain)),
    withTimeout(srvDav(domain, 'caldavs')),
    withTimeout(srvDav(domain, 'carddavs')),
    withTimeout(wellKnownDav(domain, 'caldav')),
    withTimeout(wellKnownDav(domain, 'carddav'))
  ])

  const dav = { caldav: caldavSrv ?? caldavWk, carddav: carddavSrv ?? carddavWk }
  const withDav = (found: Omit<DiscoveryResult, 'source'>, source: string): DiscoveryResult =>
    ({ ...found, caldav: found.caldav ?? dav.caldav, carddav: found.carddav ?? dav.carddav, source })

  if (hosted) return withDav(hosted, 'autoconfig')
  if (wellKnown) return withDav(wellKnown, 'autoconfig')
  if (ispdb) return withDav(ispdb, 'ispdb')

  if (mx) {
    // A custom domain hosted by a big provider: its settings, without the consumer-only extras
    const mxPreset = presetForMx(mx)
    if (mxPreset) return withDav(fromPreset(mxPreset, 'mx'), 'mx')
    const mxBase = baseDomain(mx)
    if (mxBase !== domain) {
      const viaMx = await withTimeout(autoconfig(`https://autoconfig.thunderbird.net/v1.1/${mxBase}`, email))
      if (viaMx) return withDav(viaMx, 'ispdb-mx')
    }
  }

  if (srvResult) return withDav(srvResult, 'srv')

  const guessed = await guess(domain, mx)
  if (guessed) return withDav(guessed, 'guess')

  return { ...dav, source: 'none' }
}

/**
 * Drops anything a domain's DNS or files pointed at a private address. The
 * presets are ours (Proton Mail Bridge is on 127.0.0.1 on purpose)
 */
async function publicOnly(result: DiscoveryResult): Promise<DiscoveryResult> {
  if (result.source === 'preset' || result.source === 'mx') return result
  const isPublic = (host?: string) => host ? resolveHost(host, false).then(() => true, () => false) : Promise.resolve(false)
  const urlHost = (url?: string) => {
    try {
      return url ? new URL(url).hostname : undefined
    } catch {
      return undefined
    }
  }
  const [incoming, outgoing, caldav, carddav] = await Promise.all([
    isPublic(result.incoming?.host), isPublic(result.outgoing?.host), isPublic(urlHost(result.caldav)), isPublic(urlHost(result.carddav))
  ])
  const mail = incoming && outgoing
  return {
    ...result,
    incoming: mail ? result.incoming : undefined,
    outgoing: mail ? result.outgoing : undefined,
    username: mail ? result.username : undefined,
    caldav: caldav ? result.caldav : undefined,
    carddav: carddav ? result.carddav : undefined,
    source: mail ? result.source : 'none'
  }
}

/** The provider behind a server host, when it is one that needs an app password */
export function appPasswordProvider(host: string) {
  const base = baseDomain(host)
  const preset = PRESETS.find(p => p.appPasswordUrl && [p.incoming?.host, p.outgoing?.host].some(h => h && baseDomain(h) === base))
  return preset && { name: preset.provider!, url: preset.appPasswordUrl! }
}
