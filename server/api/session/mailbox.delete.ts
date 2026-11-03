import { defineEventHandler, getValidatedQuery } from 'nuxt/server'
import { z } from 'zod'

const schema = z.object({ email: z.email() })

// Signs out of one mailbox. The last one out ends the session
export default defineEventHandler(async (event) => {
  const { email } = await getValidatedQuery(event, schema)
  const remaining = (await sessionAccounts(event)).filter(item => item.email !== email.toLowerCase())
  // Push stops for it on every browser it was turned on in
  await forgetPushFor(email).catch(() => {})
  if (!remaining.length) {
    await clearUserSession(event)
    return { signedOut: true as const }
  }
  return { signedOut: false as const, user: await saveSessionAccounts(event, remaining) }
})
