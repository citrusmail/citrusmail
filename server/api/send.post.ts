import { createError, defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const bodySchema = z.object({
  message: sendableSchema,
  /** Send later: an ISO time in the future */
  sendAt: z.iso.datetime({ offset: true }).optional(),
  /** The saved draft this message came from, removed once it's sent */
  draft: z.object({ folder: z.string().min(1).max(1000), id: z.string().regex(/^\d{1,10}$/) }).optional()
})

export default defineEventHandler(event =>
  withAccount(event, async (account) => {
    const { message, sendAt, draft } = await readValidatedBody(event, bodySchema)
    const mail = mailFor(account)

    if (sendAt && new Date(sendAt).getTime() > Date.now() + 30_000) {
      if (new Date(sendAt).getTime() > Date.now() + 366 * 86_400_000) {
        throw createError({ status: 400, message: 'Messages can be scheduled up to a year ahead.' })
      }
      const scheduled = await scheduleMessage(account, message, new Date(sendAt))
      if (draft) await mail.discardDraft(draft).catch(() => {})
      return { ok: true as const, scheduled }
    }

    const { messageId, raw } = await sendMail(account, message)
    // The message is out: a Sent folder that can't be written to is not worth an error
    await mail.appendSent(raw).catch(() => {})
    if (draft) await mail.discardDraft(draft).catch(() => {})
    return { ok: true as const, messageId }
  })
)
