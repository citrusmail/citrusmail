import { createError, defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const schema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(2000).refine(url => url.startsWith('https://'), 'Push needs an https endpoint'),
    keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) })
  }),
  timeZone: z.string().max(64).default('UTC')
})

// Keeps this browser's push subscription, with the mailboxes signed in on it
export default defineEventHandler(async (event) => {
  const { subscription, timeZone } = await readValidatedBody(event, schema)
  await requireAccount(event)
  // A push service is on the internet; anything else would have this server
  // post into its own network. Checked here, when the endpoint is handed over
  const host = new URL(subscription.endpoint).hostname.replace(/^\[|\]$/g, '')
  await resolveHost(host).catch((error) => {
    throw error instanceof BlockedHostError ? blockedHostError(host) : createError({ status: 400, message: 'Unknown push endpoint' })
  })
  await savePush(subscription, await sessionAccounts(event), timeZone)
  return { ok: true as const }
})
