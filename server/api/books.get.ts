import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler(async (event): Promise<ContactBook[]> => {
  const dav = await useCardDav(await requireAccount(event))

  return (dav?.collections ?? []).map(book => ({ id: encodeId(book.url), name: displayName(book) }))
})
