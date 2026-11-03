import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const bodySchema = z.object({
  email: z.email().max(254).transform(email => email.trim().toLowerCase())
})

export default defineEventHandler(async (event): Promise<DiscoveryResult> => {
  rateLimit(event, 'discover', 20)
  const { email } = await readValidatedBody(event, bodySchema)
  assertAllowedDomain(email)
  return discoverAccount(email)
})
