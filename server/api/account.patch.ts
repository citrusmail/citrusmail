import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const optionalUrl = z.union([z.literal(''), z.url({ protocol: /^https?$/ })]).optional()

const schema = z.object({
  name: z.string().max(100).refine(value => !/[\r\n\0]/.test(value)).optional(),
  caldav: optionalUrl,
  carddav: optionalUrl
})

// The parts of an account that can change without signing in again: the name
// on outgoing mail and the calendar and contacts addresses
export default defineEventHandler(async (event): Promise<SessionAccount> => {
  const account = await requireAccount(event)
  const body = await readValidatedBody(event, schema)
  const locked = mailConfig().locked

  const next: AccountSettings = {
    ...account,
    name: body.name !== undefined ? body.name.trim() || undefined : account.name,
    caldav: body.caldav !== undefined && !locked ? body.caldav || undefined : account.caldav,
    carddav: body.carddav !== undefined && !locked ? body.carddav || undefined : account.carddav
  }

  const [, ...others] = await sessionAccounts(event)
  return saveSessionAccounts(event, [next, ...others])
})
