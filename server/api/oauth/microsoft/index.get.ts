import { createError, defineEventHandler, getRequestURL, getValidatedQuery, sendRedirect, useRuntimeConfig, useSession } from 'nuxt/server'
import { z } from 'zod'

const querySchema = z.object({
  email: z.email().max(254).transform(email => email.trim().toLowerCase()).optional(),
  add: z.enum(['1', 'true']).optional()
})

/** The short-lived sealed cookie that ties the callback to this attempt */
export async function oauthAttempt(event: Parameters<typeof useSession>[0]) {
  const secret = String((useRuntimeConfig() as { appSecret?: string }).appSecret ?? '')
  return useSession<{ state?: string, verifier?: string, add?: boolean, email?: string }>(event, {
    name: 'citrusmail-oauth',
    password: `oauth\0${secret}`.padEnd(32, '0'),
    maxAge: 10 * 60,
    cookie: { sameSite: 'lax', httpOnly: true, secure: getRequestURL(event).protocol === 'https:' }
  })
}

export function oauthRedirectUri(event: Parameters<typeof getRequestURL>[0]) {
  const { origin } = getRequestURL(event)
  return `${origin}/api/oauth/microsoft/callback`
}

// Starts Sign in with Microsoft: remembers the attempt in a sealed cookie and
// sends the browser to Microsoft. Comes back to /api/oauth/microsoft/callback
export default defineEventHandler(async (event) => {
  rateLimit(event, 'login', 10)
  if (!oauthConfigured('microsoft')) throw createError({ status: 404, message: 'Sign in with Microsoft isn’t set up on this server.' })
  const { email, add } = await getValidatedQuery(event, querySchema)
  if (email) assertAllowedDomain(email)

  const { state, verifier, challenge } = microsoftChallenge()
  const attempt = await oauthAttempt(event)
  await attempt.update({ state, verifier, add: !!add, email })
  return sendRedirect(event, microsoftAuthorizeUrl(oauthRedirectUri(event), state, challenge, email), 302)
})
