import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler(async (event) => {
  await requireAccount(event)
  return { publicKey: (await vapidKeys()).publicKey }
})
