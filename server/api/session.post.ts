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
  incoming: server.extend({ protocol: z.enum(['imap', 'pop3']) }).optional(),
  outgoing: server.optional(),
  caldav: davUrl,
  carddav: davUrl,
  /** Add this mailbox next to the ones already signed in, instead of replacing them */
  add: z.boolean().optional()
})

async function verifyIncoming(account: AccountSettings) {
  if (account.incoming.protocol === 'pop3') await withPop3(account, async () => {})
  else await verifyImap(account)
}

export default defineEventHandler(async (event): Promise<SessionAccount> => {
  rateLimit(event, 'login', 10)
  const body = await readValidatedBody(event, bodySchema)
  assertAllowedDomain(body.email)
  // Per address too, so this server can't be used to try many passwords on one
  // mailbox from many IPs
  rateLimit(event, 'login-email', 10, 15 * 60_000, body.email)

  const config = mailConfig()
  // With allowed domains set, those domains' own servers are the only ones:
  // a hand-entered server would let anyone "sign in" as user@company.com
  const custom = !config.locked && !config.allowedDomains.length && body.incoming && body.outgoing
  const found = custom && body.caldav !== undefined && body.carddav !== undefined
    ? undefined
    : await discoverAccount(body.email)

  const incoming = custom ? body.incoming : found?.incoming
  const outgoing = custom ? body.outgoing : found?.outgoing
  if (!incoming || !outgoing) {
    const domain = body.email.split('@')[1]
    throw createError({ status: 400, message: `We couldn't find the mail servers for ${domain}. Open Advanced and enter them.`, data: { discovery: false } })
  }

  const dav = (key: 'caldav' | 'carddav') => config[key] ?? (custom && body[key] !== undefined ? body[key] || undefined : found?.[key])
  const account: AccountSettings = JSON.parse(JSON.stringify({
    email: body.email,
    name: body.name || undefined,
    username: body.username || found?.username,
    password: body.password,
    incoming,
    outgoing,
    caldav: dav('caldav'),
    carddav: dav('carddav')
  }))

  const [incomingResult, outgoingResult] = await Promise.allSettled([verifyIncoming(account), verifySmtp(account)])
  const failures = [
    incomingResult.status === 'rejected' ? describeMailError(incomingResult.reason, incoming, false) : undefined,
    outgoingResult.status === 'rejected' ? describeMailError(outgoingResult.reason, outgoing, false) : undefined
  ]
  if (failures[0] || failures[1]) {
    // The same wrong password usually fails both sides: say it once
    const messages = [...new Set(failures.filter(f => f).map(f => f!.message))]
    const message = failures[0]?.auth && failures[1]?.auth ? failures[0].message : messages.join(' ')
    throw createError({
      status: 400,
      message,
      data: { incoming: failures[0]?.message, outgoing: failures[1]?.message, auth: Boolean(failures[0]?.auth || failures[1]?.auth) }
    })
  }

  // Adding a mailbox keeps the others; signing in to one already here refreshes it
  const existing = body.add ? await sessionAccounts(event) : []
  const others = existing.filter(item => item.email !== account.email)
  if (others.length >= MAX_MAILBOXES) {
    throw createError({ status: 400, message: `You can have ${MAX_MAILBOXES} mailboxes open at once. Sign out of one first.` })
  }
  return saveSessionAccounts(event, [account, ...others])
})
