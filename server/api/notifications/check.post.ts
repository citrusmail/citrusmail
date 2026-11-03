import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

// New mail in every signed-in mailbox since the cursors the browser holds.
// Each mailbox reads its own synced settings for the folders to watch
const schema = z.object({
  cursors: z.record(z.string().max(254), z.record(z.string().max(1000), z.number().nonnegative())).default({})
})

export default defineEventHandler(async (event) => {
  const { cursors } = await readValidatedBody(event, schema)
  const accounts = await sessionAccounts(event)
  if (!accounts.length) await requireAccount(event)
  // The open mailbox's settings decide for all of them: that's the page you set them on
  const settings = await readStore<Partial<UserSettings>>(accounts[0]!, 'settings', {})
  // Opens Faivelo tracked, picked up on the same rhythm (throttled inside),
  // whether or not new-mail alerts are on
  for (const account of accounts) inBackground(() => syncFaiveloOpens(account)).catch(() => 0)

  const results = await Promise.all(accounts.map(async (account) => {
    const email = account.email.toLowerCase()
    const folders = notifyFolders(settings.notifications, email)
    if (!folders.length) return { email, cursors: {}, messages: [] as MessageSummary[] }
    const news = await checkNewMail(account, folders, cursors[email] ?? {}).catch(() => ({ cursors: cursors[email] ?? {}, messages: [] as MessageSummary[] }))
    return { email, ...news }
  }))

  return {
    cursors: Object.fromEntries(results.map(result => [result.email, result.cursors])),
    messages: results.flatMap(result => result.messages.map(message => ({ ...message, mailbox: result.email })))
  }
})
