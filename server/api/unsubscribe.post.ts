import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const schema = z.object({ folder: z.string().min(1).max(1000), id: messageIdParam })

export default defineEventHandler(async (event) => {
  const { folder, id } = await readValidatedBody(event, schema)
  return withAccount(event, (account): Promise<UnsubscribeResult> => unsubscribe(account, folder, id))
})
