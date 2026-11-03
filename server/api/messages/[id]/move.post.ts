import { defineEventHandler, getRouterParam, getValidatedQuery, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

// `to` is a folder path or one of the roles 'archive' | 'trash' | 'junk' | 'inbox'
const bodySchema = z.object({
  to: z.string().min(1).max(1000)
})

export default defineEventHandler(async (event) => {
  const id = messageIdParam.parse(getRouterParam(event, 'id', { decode: true }))
  const { folder } = await getValidatedQuery(event, folderQuery)
  const { to } = await readValidatedBody(event, bodySchema)
  await withAccount(event, account => mailFor(account).move(folder, id, to))
  return { ok: true as const }
})
