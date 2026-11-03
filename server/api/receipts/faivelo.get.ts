import { defineEventHandler } from 'nuxt/server'

// Whether the open mailbox is hosted by Faivelo, which can track opens for it
// (only when NUXT_FAIVELO_URL turns that on for this server)
export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  if (!faiveloBase()) return { available: false }
  return { available: isFaiveloHost(account.incoming.host) || isFaiveloHost(account.outgoing.host) }
})
