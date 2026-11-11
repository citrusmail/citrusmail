import type { RequestEvent } from 'nuxt/server'
import { createError, isNuxtError, useRuntimeConfig } from 'nuxt/server'

/** The signed-in account's settings, or a 401 */
export async function requireAccount(event: RequestEvent): Promise<AccountSettings> {
  const session = await getUserSession(event)
  const account = session.secure?.account
  if (!account) {
    throw createError({ status: 401, message: 'Please sign in.' })
  }
  if (!account.oauth) return account
  // An OAuth mailbox: a token about to expire is renewed and the cookie
  // updated with the request's response, so every route sees a working one
  const fresh = await freshAccount(account).catch(() => undefined)
  if (!fresh) throw createError({ status: 401, message: 'Your Microsoft sign-in has expired. Please sign in again.', data: { auth: true } })
  if (fresh !== account) await saveSessionAccounts(event, [fresh, ...(session.secure?.others ?? [])])
  return fresh
}

/** Logs in to the incoming and outgoing servers and logs out: the check before a session is created */
export async function verifyAccount(account: AccountSettings): Promise<void> {
  const { protocol } = account.incoming
  const verifyIncoming: Promise<unknown> = protocol === 'pop3'
    ? withPop3(account, async () => {})
    : protocol === 'jmap' ? verifyJmap(account) : verifyImap(account)
  // A JMAP server that sends mail itself needs no SMTP server; one that can't falls back to SMTP
  const verifyOutgoing = protocol === 'jmap'
    ? (verifyIncoming as Promise<{ submission: boolean }>).then(found => found.submission ? undefined : verifySmtp(account), () => undefined)
    : verifySmtp(account)
  const [incomingResult, outgoingResult] = await Promise.allSettled([verifyIncoming, verifyOutgoing])
  const failures = [
    incomingResult.status === 'rejected' ? describeMailError(incomingResult.reason, account.incoming, false) : undefined,
    outgoingResult.status === 'rejected' ? describeMailError(outgoingResult.reason, account.outgoing, false) : undefined
  ]
  if (!failures[0] && !failures[1]) return
  // The same wrong password usually fails both sides: say it once
  const messages = [...new Set(failures.filter(f => f).map(f => f!.message))]
  const message = failures[0]?.auth && failures[1]?.auth ? failures[0].message : messages.join(' ')
  throw createError({
    status: 400,
    message,
    data: { incoming: failures[0]?.message, outgoing: failures[1]?.message, auth: Boolean(failures[0]?.auth || failures[1]?.auth) }
  })
}

/**
 * Runs a mail operation for the signed-in account and turns protocol errors
 * into plain-language HTTP errors
 */
export async function withAccount<T>(event: RequestEvent, fn: (account: AccountSettings) => Promise<T>): Promise<T> {
  const account = await requireAccount(event)
  try {
    return await fn(account)
  } catch (error) {
    if (isNuxtError(error)) throw error
    const { mailboxMissing, responseText } = error as { mailboxMissing?: boolean, responseText?: string }
    if (mailboxMissing || /no such mailbox|nonexistent|doesn't exist|does not exist|unknown mailbox/i.test(responseText ?? '')) {
      throw createError({ status: 404, message: 'That folder doesn\'t exist.' })
    }
    const side = (error as { side?: 'incoming' | 'outgoing' }).side ?? 'incoming'
    const server = side === 'outgoing' ? account.outgoing : account.incoming
    const { message, auth } = describeMailError(error, server)
    throw createError({ status: auth ? 401 : 502, message, data: { auth } })
  }
}

export function toSessionAccount(account: AccountSettings, others: AccountSettings[] = []): SessionAccount {
  return {
    email: account.email,
    name: account.name,
    protocol: account.incoming.protocol,
    hasCalendar: Boolean(account.caldav),
    hasContacts: Boolean(account.carddav),
    mailboxes: [account, ...others].map(item => ({ email: item.email, name: item.name }))
  }
}

/** The mailboxes a session cookie can hold: each one adds its sealed settings to the cookie */
export const MAX_MAILBOXES = 4

/** Every mailbox signed in on this browser, the open one first */
export async function sessionAccounts(event: RequestEvent): Promise<AccountSettings[]> {
  const session = await getUserSession(event)
  const account = session.secure?.account
  return account ? [account, ...(session.secure?.others ?? [])] : []
}

/** Saves the mailboxes, the first one open */
export async function saveSessionAccounts(event: RequestEvent, accounts: AccountSettings[]): Promise<SessionAccount> {
  const [account, ...others] = accounts
  if (!account) throw createError({ status: 400, message: 'No mailbox to open.' })
  const user = toSessionAccount(account, others)
  await replaceUserSession(event, { user, secure: { account, others } })
  return user
}

/* ------------------------------------------------------------------ */
/* Company presets from runtime config (NUXT_MAIL_*)                   */
/* ------------------------------------------------------------------ */

interface EnvServer { host: string, port: number | string, security: string }

/** With JMAP sending through the server, SMTP is only a fallback: the same host, on submission */
export function jmapOutgoing(incoming: IncomingSettings): ServerSettings {
  const host = incoming.url ? new URL(incoming.url).hostname.replace(/^\[|\]$/g, '') : incoming.host
  return { host, port: 587, security: 'starttls' }
}

/** NUXT_MAIL_JMAP_URL (a session URL), or NUXT_MAIL_JMAP_HOST with _PORT and _SECURITY */
function envJmap(config: EnvServer & { url?: string }): IncomingSettings | undefined {
  if (config?.url) {
    const url = new URL(config.url)
    const secure = url.protocol === 'https:'
    return { protocol: 'jmap', host: url.hostname.replace(/^\[|\]$/g, ''), port: Number(url.port) || (secure ? 443 : 80), security: secure ? 'tls' : 'none', url: url.toString() }
  }
  const server = envServer(config, 443)
  return server && { protocol: 'jmap', ...server, security: server.security === 'none' ? 'none' : 'tls' }
}

function envServer(server: EnvServer, fallbackPort: number): ServerSettings | undefined {
  if (!server?.host) return undefined
  const port = Number(server.port) || fallbackPort
  const security = (['tls', 'starttls', 'none'].includes(server.security) ? server.security : defaultSecurity(port)) as Security
  return { host: server.host, port, security }
}

export function mailConfig() {
  const config = useRuntimeConfig().mail as {
    imap: EnvServer
    pop3: EnvServer
    jmap: EnvServer & { url: string }
    smtp: EnvServer
    caldavUrl: string
    carddavUrl: string
    allowedDomains: string
  }
  const imap = envServer(config.imap, 993)
  const pop3 = envServer(config.pop3, 995)
  const jmap = envJmap(config.jmap)
  const incoming: AccountSettings['incoming'] | undefined = imap
    ? { protocol: 'imap', ...imap }
    : jmap ?? (pop3 ? { protocol: 'pop3', ...pop3 } : undefined)

  return {
    incoming,
    // A JMAP server usually sends mail itself, so it needs no SMTP settings
    outgoing: envServer(config.smtp, 587) ?? (incoming?.protocol === 'jmap' ? jmapOutgoing(incoming) : undefined),
    caldav: config.caldavUrl || undefined,
    carddav: config.carddavUrl || undefined,
    /** Servers are pinned: client-supplied settings are ignored */
    locked: Boolean(incoming),
    allowedDomains: (config.allowedDomains || '').split(',').map(d => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean)
  }
}

export function assertAllowedDomain(email: string) {
  const { allowedDomains } = mailConfig()
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  if (allowedDomains.length && !allowedDomains.includes(domain)) {
    throw createError({ status: 400, message: `Only ${allowedDomains.map(d => `@${d}`).join(', ')} addresses can sign in here.` })
  }
}

/** Discovery with the company presets layered on top */
export async function discoverAccount(email: string): Promise<DiscoveryResult> {
  const config = mailConfig()
  if (config.incoming && config.outgoing) {
    // Servers set in the environment: their calendars are where they say, or on the mail host
    const onHost = config.caldav && config.carddav ? {} : await davOnMailHosts([config.incoming.host, config.outgoing.host])
    return { incoming: config.incoming, outgoing: config.outgoing, caldav: config.caldav ?? onHost.caldav, carddav: config.carddav ?? onHost.carddav, source: 'config' }
  }
  const found = await discover(email)
  return {
    ...found,
    oauthReady: found.oauth ? oauthConfigured(found.oauth) : undefined,
    incoming: config.incoming ?? found.incoming,
    outgoing: config.outgoing ?? found.outgoing,
    caldav: config.caldav ?? found.caldav,
    carddav: config.carddav ?? found.carddav
  }
}
