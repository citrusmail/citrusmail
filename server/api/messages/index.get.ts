import { defineEventHandler, getValidatedQuery } from 'nuxt/server'
import { z } from 'zod'

const querySchema = z.object({
  folder: z.string().min(1).max(1000),
  before: z.string().max(200).optional(),
  q: z.string().trim().max(200).optional(),
  unread: z.enum(['1', 'true']).optional(),
  flagged: z.enum(['1', 'true']).optional(),
  from: z.string().trim().max(200).optional(),
  within: z.enum(['week', 'month', 'year']).optional(),
  on: z.iso.date().optional(),
  attachments: z.enum(['1', 'true']).optional()
})

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, querySchema)
  return withAccount(event, async (account): Promise<MessagePage> => {
    const page = await mailFor(account).listMessages(query.folder, {
      before: query.before || undefined,
      q: query.q || undefined,
      unread: Boolean(query.unread),
      flagged: Boolean(query.flagged),
      from: query.from || undefined,
      within: query.within,
      on: query.on,
      attachments: Boolean(query.attachments)
    })
    return { ...page, messages: await withReceipts(account, page.messages) }
  })
})
