import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const schema = z.object({ endpoint: z.string().url().max(2000) })

export default defineEventHandler(async (event) => {
  const { endpoint } = await readValidatedBody(event, schema)
  await requireAccount(event)
  await removePush(endpoint)
  return { ok: true as const }
})
