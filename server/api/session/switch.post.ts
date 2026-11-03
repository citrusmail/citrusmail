import { createError, defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const schema = z.object({ email: z.email() })

// Opens another of the mailboxes signed in on this browser
export default defineEventHandler(async (event): Promise<SessionAccount> => {
  const { email } = await readValidatedBody(event, schema)
  const accounts = await sessionAccounts(event)
  const target = accounts.find(item => item.email === email.toLowerCase())
  if (!target) throw createError({ status: 404, message: 'That mailbox isn\'t signed in here.' })
  return saveSessionAccounts(event, [target, ...accounts.filter(item => item !== target)])
})
