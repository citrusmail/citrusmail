import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const schema = outgoingSchema.extend({
  replace: z.object({ folder: z.string().min(1).max(1000), id: draftId }).optional()
})

// Saves the composer's message to the Drafts folder, replacing its earlier copy
export default defineEventHandler(event =>
  withAccount(event, async (account): Promise<DraftRef> => {
    const { replace, ...message } = await readValidatedBody(event, schema)
    const raw = await composeMessage(account, message, { keepBcc: true }).build()
    return mailFor(account).saveDraft(raw, replace)
  })
)
