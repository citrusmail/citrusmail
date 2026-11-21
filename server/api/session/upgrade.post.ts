import { defineEventHandler } from 'nuxt/server'

// Asked once as the app starts, before any mail loads: signed-in mailboxes
// still on IMAP move to JMAP where their server speaks it (protocol-switch.ts)
export default defineEventHandler(async (event): Promise<{ switched: string[] }> => {
  rateLimit(event, 'session-upgrade', 20)
  await requireAccount(event)
  return { switched: await upgradeToJmap(event) }
})
