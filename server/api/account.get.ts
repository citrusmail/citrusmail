import { defineEventHandler } from 'nuxt/server'

// What the account settings dialog shows: everything but the password
export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  return {
    email: account.email,
    name: account.name ?? '',
    incoming: account.incoming,
    outgoing: account.outgoing,
    caldav: account.caldav ?? '',
    carddav: account.carddav ?? '',
    locked: mailConfig().locked
  }
})
