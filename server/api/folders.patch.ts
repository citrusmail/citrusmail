import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const schema = z.object({
  path: z.string().min(1).max(1000),
  name: folderName
})

export default defineEventHandler(async (event) => {
  const { path, name } = await readValidatedBody(event, schema)
  const account = await requireAccount(event)
  const renamed = await withAccount(event, account => mailFor(account).renameFolder(path, name))
  // Rules that filed into the old folder follow it
  const rules = await readStore<MailRule[]>(account, 'rules', [])
  if (rules.some(rule => rule.folder === path)) {
    await writeStore(account, 'rules', rules.map(rule => rule.folder === path ? { ...rule, folder: renamed } : rule))
  }
  return { path: renamed }
})
