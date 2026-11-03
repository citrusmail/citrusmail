import type { RequestEvent } from 'nuxt/server'
import { createError, isNuxtError, useRuntimeConfig } from 'nuxt/server'

/** The signed-in account's settings, or a 401 */
export async function requireAccount(event: RequestEvent): Promise<AccountSettings> {
  const session = await getUserSession(event)
  const account = session.secure?.account
  if (!account) {
    throw createError({ status: 401, message: 'Please sign in.' })
  }
  return account
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
    smtp: EnvServer
    caldavUrl: string
    carddavUrl: string
    allowedDomains: string
  }
  const imap = envServer(config.imap, 993)
  const pop3 = envServer(config.pop3, 995)
  const incoming: AccountSettings['incoming'] | undefined = imap
    ? { protocol: 'imap', ...imap }
    : pop3 ? { protocol: 'pop3', ...pop3 } : undefined

  return {
    incoming,
    outgoing: envServer(config.smtp, 587),
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
    incoming: config.incoming ?? found.incoming,
    outgoing: config.outgoing ?? found.outgoing,
    caldav: config.caldav ?? found.caldav,
    carddav: config.carddav ?? found.carddav
  }
}
