import { defineEventHandler } from 'nuxt/server'

// The rules with their folders as this account names them, so a rule saved on
// a device using the other protocol (IMAP or JMAP) shows its folder here too
export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const rules = await readStore<MailRule[]>(account, 'rules', [])
  if (!rules.length || account.incoming.protocol === 'pop3') return rules
  const folders = await withAccount(event, account => mailFor(account).listFolders()).catch(() => undefined)
  if (!folders) return rules
  return rules.map((rule) => {
    const folder = matchFolder(folders, rule.folder, rule.folderName)
    return folder ? { ...rule, folder: folder.path } : rule
  })
})
