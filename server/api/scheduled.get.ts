import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler(async (event): Promise<ScheduledMessage[]> => listScheduled(await requireAccount(event)))
