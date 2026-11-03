import { createError, defineEventHandler, getRouterParam, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const schema = z.object({
  sendAt: z.iso.datetime({ offset: true }).refine(value => Date.parse(value) > Date.now() + 30_000, 'Pick a time at least a minute from now')
})

// Moves a scheduled message to another time
export default defineEventHandler(async (event): Promise<ScheduledMessage> => {
  const id = z.uuid().parse(getRouterParam(event, 'id'))
  const { sendAt } = await readValidatedBody(event, schema)
  const entry = await rescheduleMessage(await requireAccount(event), id, new Date(sendAt))
  if (!entry) throw createError({ status: 404, message: 'That message has already gone out.' })
  return entry
})
