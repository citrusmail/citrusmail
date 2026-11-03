import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler(async (event): Promise<Contact[]> => {
  const dav = await useCardDav(await requireAccount(event))
  if (!dav) {
    return []
  }

  const results = await Promise.allSettled(dav.collections.map(async (book) => {
    const bookId = encodeId(book.url)
    const cards = await dav.client.fetchVCards({ addressBook: book, urlFilter: url => !url.endsWith('/') })

    return cards.flatMap((card) => {
      if (typeof card.data !== 'string' || !card.data) {
        return []
      }
      try {
        return [vcardToContact(card.data, encodeId(new URL(card.url, book.url).href), bookId)]
      } catch {
        // One malformed card should not hide the rest of the book
        return []
      }
    })
  }))

  const failed = results.find(result => result.status === 'rejected')
  if (failed && results.every(result => result.status === 'rejected')) {
    throw davError(failed.reason, dav.host, 'carddav')
  }

  return results
    .flatMap(result => result.status === 'fulfilled' ? result.value : [])
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
})
