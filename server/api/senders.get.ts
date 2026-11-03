import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler(async (event): Promise<SenderLists> => readSenders(await requireAccount(event)))
