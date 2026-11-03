import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler(async (event): Promise<AiStatus> => aiStatus(await requireAccount(event)))
