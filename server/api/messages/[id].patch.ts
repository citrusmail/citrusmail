import { defineEventHandler, getRouterParam, getValidatedQuery, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const bodySchema = z.object({
  unread: z.boolean().optional(),
  flagged: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const id = messageIdParam.parse(getRouterParam(event, 'id', { decode: true }))
  const { folder } = await getValidatedQuery(event, folderQuery)
  const flags = await readValidatedBody(event, bodySchema)
  await withAccount(event, account => mailFor(account).setFlags(folder, id, flags))
  return { ok: true as const }
})
