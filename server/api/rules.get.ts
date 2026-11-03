import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  return readStore<MailRule[]>(account, 'rules', [])
})
