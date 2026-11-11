import { defineEventHandler, getRouterParam, getValidatedQuery } from 'nuxt/server'
import { z } from 'zod'

const querySchema = folderQuery.extend({
  images: z.enum(['0', '1']).optional(),
  /** Read it without marking it read: fetched ahead, before it's opened */
  peek: z.enum(['0', '1']).optional()
})

// Remote images load when the reader asks (images=1), when Settings says
// always, or when the sender is on the allow list and Settings says so
export default defineEventHandler(async (event) => {
  const id = messageIdParam.parse(getRouterParam(event, 'id', { decode: true }))
  const { folder, images, peek } = await getValidatedQuery(event, querySchema)
  return withAccount(event, async (account): Promise<MessageDetail> => {
    let policy: RemotePolicy = images === '1'
    if (!policy) {
      const settings = await readStore<Partial<UserSettings>>(account, 'settings', {})
      const mode = settings.remoteImages ?? 'allowed'
      if (mode === 'always') policy = true
      else if (mode === 'allowed') {
        const { allowed } = await readSenders(account)
        policy = from => senderMatches(allowed, from.address)
      }
    }
    // Fetching ahead goes over IMAP's background connection, so it never holds up what's clicked
    const read = () => mailFor(account).getMessage(folder, id, policy, peek !== '1')
    const message = await (peek === '1' ? inBackground(read) : read())
    const [withOpened] = await withReceipts(account, [message])
    return withOpened!
  })
})
