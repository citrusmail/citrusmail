import { defineEventHandler, readValidatedBody, setResponseStatus } from 'nuxt/server'

export default defineEventHandler(async (event): Promise<Contact> => {
  const body = await readValidatedBody(event, contactSchema)
  const dav = await useCardDav(await requireAccount(event))
  if (!dav) {
    throw notSetUp('carddav')
  }

  const book = findCollection(dav, body.bookId)
  const uid = crypto.randomUUID()
  const url = objectUrl(book, uid, '.vcf')

  await putObject(dav, url, contactToVcard(body, uid))

  setResponseStatus(event, 201)

  return { ...body, id: encodeId(url) }
})
