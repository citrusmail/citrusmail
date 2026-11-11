import { defineEventHandler, getValidatedQuery, sendRedirect } from 'nuxt/server'
import { z } from 'zod'
import { oauthAttempt, oauthRedirectUri } from './index.get'

const querySchema = z.object({
  code: z.string().max(4096).optional(),
  state: z.string().max(256).optional(),
  error: z.string().max(100).optional(),
  error_description: z.string().max(1000).optional()
})

/** Back to the sign-in page with what went wrong, never with anything secret */
function failed(event: Parameters<typeof sendRedirect>[0], message: string, add?: boolean) {
  const query = new URLSearchParams({ error: message.slice(0, 300), ...(add ? { add: '1' } : {}) })
  return sendRedirect(event, `/login?${query}`, 302)
}

// Microsoft sends the browser here with a code. The code becomes tokens, the
// tokens are tried on the mail servers, and the mailbox joins the session
// exactly as a password sign-in would
export default defineEventHandler(async (event) => {
  rateLimit(event, 'login', 10)
  const query = await getValidatedQuery(event, querySchema)
  const attempt = await oauthAttempt(event)
  const { state, verifier, add, email: typed } = attempt.data
  await attempt.clear()

  if (query.error) return failed(event, query.error === 'access_denied' ? 'Microsoft sign-in was cancelled.' : `Microsoft said: ${query.error_description?.split('\n')[0] ?? query.error}`, add)
  if (!query.code || !state || !verifier || query.state !== state) return failed(event, 'The sign-in attempt expired. Please try again.', add)

  let email: string
  let oauth: OAuthTokens
  try {
    ({ email, oauth } = await microsoftExchange(query.code, verifier, oauthRedirectUri(event)))
  } catch (error) {
    return failed(event, (error as Error).message, add)
  }

  try {
    assertAllowedDomain(email)
  } catch (error) {
    return failed(event, (error as { message: string }).message, add)
  }

  // The servers come from the environment when it pins them, else Microsoft's own
  const config = mailConfig()
  const account: AccountSettings = {
    email,
    username: email,
    password: '',
    oauth,
    incoming: config.incoming ?? MICROSOFT_IMAP,
    outgoing: config.outgoing ?? MICROSOFT_SMTP,
    caldav: config.caldav,
    carddav: config.carddav
  }
  try {
    await verifyAccount(account)
  } catch (error) {
    const message = (error as { message?: string }).message ?? 'The mail servers refused the Microsoft sign-in.'
    return failed(event, typed && typed !== email ? `Microsoft signed in ${email}, not ${typed}. ${message}` : message, add)
  }

  const existing = add ? await sessionAccounts(event) : []
  const others = existing.filter(item => item.email !== account.email)
  if (others.length >= MAX_MAILBOXES) return failed(event, `You can have ${MAX_MAILBOXES} mailboxes open at once. Sign out of one first.`, add)
  await saveSessionAccounts(event, [account, ...others])
  return sendRedirect(event, '/mail/INBOX', 302)
})
