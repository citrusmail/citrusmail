import { defineEventHandler, getRouterParam, getValidatedQuery } from 'nuxt/server'

// Moves to Trash; a message already in Trash (or an account without one) is deleted for good
export default defineEventHandler(async (event) => {
  const id = messageIdParam.parse(getRouterParam(event, 'id', { decode: true }))
  const { folder } = await getValidatedQuery(event, folderQuery)
  await withAccount(event, account => mailFor(account).remove(folder, id))
  return { ok: true as const }
})
