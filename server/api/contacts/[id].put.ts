import { createError, defineEventHandler, getRouterParam, readValidatedBody } from 'nuxt/server'

export default defineEventHandler(async (event): Promise<Contact> => {
  const id = getRouterParam(event, 'id', { decode: true })!
  const body = await readValidatedBody(event, contactSchema)
  const dav = await useCardDav(await requireAccount(event))
  if (!dav) {
    throw notSetUp('carddav')
  }

  const url = decodeId(id)
  const book = collectionOf(dav, url)
  const existing = await getObject(dav, url)
  if (!existing) {
    throw createError({ status: 404, message: 'This contact no longer exists' })
  }

  await putObject(dav, url, patchVcard(existing.data, body), existing.etag)

  return { ...body, id, bookId: encodeId(book.url) }
})
