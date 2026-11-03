import { defineEventHandler, getRouterParam, getValidatedQuery } from 'nuxt/server'
import { z } from 'zod'

const querySchema = folderQuery.extend({
  images: z.enum(['0', '1']).optional()
})

// Remote images load when the reader asks (images=1), when Settings says
// always, or when the sender is on the allow list and Settings says so
export default defineEventHandler(async (event) => {
  const id = messageIdParam.parse(getRouterParam(event, 'id', { decode: true }))
  const { folder, images } = await getValidatedQuery(event, querySchema)
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
    const message = await mailFor(account).getMessage(folder, id, policy)
    const [withOpened] = await withReceipts(account, [message])
    return withOpened!
  })
})
