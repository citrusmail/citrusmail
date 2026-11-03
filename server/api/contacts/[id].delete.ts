import { defineEventHandler, getRouterParam } from 'nuxt/server'

// Idempotent: a contact that is already gone is not an error
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id', { decode: true })!
  const dav = await useCardDav(await requireAccount(event))
  if (!dav) {
    throw notSetUp('carddav')
  }

  const url = decodeId(id)
  collectionOf(dav, url)
  await deleteObject(dav, url)

  return { id }
})
