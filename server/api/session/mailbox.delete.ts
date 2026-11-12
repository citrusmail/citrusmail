import { defineEventHandler, getValidatedQuery } from 'nuxt/server'
import { z } from 'zod'

const schema = z.object({ email: z.email() })

// Signs out of one mailbox. The last one out ends the session
export default defineEventHandler(async (event) => {
  const { email } = await getValidatedQuery(event, schema)
  const accounts = await sessionAccounts(event)
  const remaining = accounts.filter(item => item.email !== email.toLowerCase())
  // Push stops for it on every browser it was turned on in. Only for a mailbox
  // signed in here: anyone could otherwise turn off someone else's
  if (remaining.length !== accounts.length) await forgetPushFor(email).catch(() => {})
  if (!remaining.length) {
    await clearUserSession(event)
    return { signedOut: true as const }
  }
  return { signedOut: false as const, user: await saveSessionAccounts(event, remaining) }
})
