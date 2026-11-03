import { defineEventHandler, getValidatedQuery } from 'nuxt/server'
import { z } from 'zod'

const schema = z.object({ folder: z.string().min(1).max(1000), id: z.string().regex(/^\d{1,10}$/) })

export default defineEventHandler(async (event) => {
  const draft = await getValidatedQuery(event, schema)
  await withAccount(event, account => mailFor(account).discardDraft(draft))
  return { ok: true as const }
})
