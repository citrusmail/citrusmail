import { createError, defineEventHandler, getRouterParam } from 'nuxt/server'
import { z } from 'zod'

// Cancels a scheduled message and returns it, so the composer can open it again
export default defineEventHandler(async (event) => {
  const id = z.uuid().parse(getRouterParam(event, 'id'))
  const message = await cancelScheduled(await requireAccount(event), id)
  if (!message) throw createError({ status: 404, message: 'That message has already gone out.' })
  return message
})
