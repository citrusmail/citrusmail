import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler(async (event) => {
  const moved = await withAccount(event, account => runRules(account))
  return { moved }
})
