import { createError, defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

// No CR/LF/NUL anywhere a value ends up in an IMAP/POP3/SMTP command line
const noControl = (value: string) => !/[\r\n\0]/.test(value)

const server = z.object({
  host: z.string().trim().min(1).max(255).regex(/^[\w.:[\]-]+$/, 'Invalid host'),
  port: z.coerce.number().int().min(1).max(65535),
  security: z.enum(['tls', 'starttls', 'none'])
})

const davUrl = z.union([z.url({ protocol: /^https?$/ }), z.literal('')]).optional()

const bodySchema = z.object({
  email: z.email().max(254).transform(email => email.trim().toLowerCase()),
  password: z.string().min(1, 'Password is required').max(1024).refine(noControl),
  name: z.string().trim().max(100).refine(noControl).optional(),
  username: z.string().trim().max(254).refine(noControl).optional(),
  incoming: server.extend({
    protocol: z.enum(['imap', 'pop3', 'jmap']),
    /** JMAP: a session URL, when it isn't at /.well-known/jmap on the host */
    url: z.url({ protocol: /^https?$/ }).max(1000).optional(),
    auth: z.enum(['basic', 'bearer']).optional()
  }).optional(),
  outgoing: server.optional(),
  caldav: davUrl,
  carddav: davUrl,
  /** Add this mailbox next to the ones already signed in, instead of replacing them */
  add: z.boolean().optional()
})

/**
 * The JMAP-only fields are dropped from IMAP and POP3 settings. A JMAP
 * session URL decides the host: it's the server actually signed in to
 */
function jmapOnly(incoming: IncomingSettings): IncomingSettings {
  if (incoming.protocol === 'jmap') return jmapBoundIncoming(incoming)
  const { url: _url, auth: _auth, ...rest } = incoming
  return rest
}

export default defineEventHandler(async (event): Promise<SessionAccount> => {
  rateLimit(event, 'login', 10)
  const body = await readValidatedBody(event, bodySchema)
  assertAllowedDomain(body.email)
  // Per address too, so this server can't be used to try many passwords on one
  // mailbox from many IPs
  rateLimit(event, 'login-email', 10, 15 * 60_000, body.email)
  // The login name is what the password is tried against, whatever address is beside it
  const login = body.username?.toLowerCase()
  if (login && login !== body.email.toLowerCase()) rateLimit(event, 'login-email', 10, 15 * 60_000, login)

  const config = mailConfig()
  // With allowed domains set, those domains' own servers are the only ones:
  // a hand-entered server would let anyone "sign in" as user@company.com
  // JMAP can do without SMTP settings: the server usually sends mail itself
  const custom = !config.locked && !config.allowedDomains.length && body.incoming && (body.outgoing || body.incoming.protocol === 'jmap')
  const found = custom && body.caldav !== undefined && body.carddav !== undefined
    ? undefined
    : await discoverAccount(body.email)

  // The servers to try, in order. When discovery found a JMAP server it
  // goes first, and IMAP (or POP3) is the fallback when it won't sign in
  const jmap = !custom && found?.jmap && !found.oauth ? jmapIncoming(found.jmap) : undefined
  const options: { incoming: IncomingSettings, outgoing: ServerSettings }[] = custom
    ? [{ incoming: jmapOnly(body.incoming!), outgoing: body.outgoing ?? jmapOutgoing(body.incoming!) }]
    : [
        ...(jmap ? [{ incoming: jmap, outgoing: found?.outgoing ?? jmapOutgoing(jmap) }] : []),
        ...(found?.incoming && found.outgoing ? [{ incoming: found.incoming, outgoing: found.outgoing }] : [])
      ]
  if (!options.length) {
    const domain = body.email.split('@')[1]
    throw createError({ status: 400, message: `We couldn't find the mail servers for ${domain}. Open Advanced and enter them.`, data: { discovery: false } })
  }

  const dav = (key: 'caldav' | 'carddav') => config[key] ?? (custom && body[key] !== undefined ? body[key] || undefined : found?.[key])
  const base = {
    email: body.email,
    name: body.name || undefined,
    username: body.username || found?.username,
    password: body.password,
    caldav: dav('caldav'),
    carddav: dav('carddav')
  }

  // A provider that takes no password says so before the servers are even tried
  if (found?.oauth && !custom) {
    throw createError({ status: 400, message: found.oauthReady ? 'This mailbox signs in with Microsoft. Use the Sign in with Microsoft button.' : 'Microsoft no longer accepts passwords from mail apps, and this copy isn’t set up for Sign in with Microsoft yet. Whoever runs it needs to add a Microsoft app id (see the README).', data: { auth: true } })
  }

  let account: AccountSettings | undefined
  let failure: unknown
  for (const option of options) {
    try {
      account = await verifyAccount(JSON.parse(JSON.stringify({ ...base, ...option })))
      break
    } catch (error) {
      failure = error
    }
  }
  // Every option failed: the last one's error (IMAP's, when JMAP went first) says why
  if (!account) throw failure

  // Adding a mailbox keeps the others; signing in to one already here refreshes it
  const existing = body.add ? await sessionAccounts(event) : []
  const others = existing.filter(item => item.email !== account.email)
  if (others.length >= MAX_MAILBOXES) {
    throw createError({ status: 400, message: `You can have ${MAX_MAILBOXES} mailboxes open at once. Sign out of one first.` })
  }
  return saveSessionAccounts(event, [account, ...others])
})
