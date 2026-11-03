import { defineEventHandler, getValidatedQuery } from 'nuxt/server'
import { z } from 'zod'

const schema = z.object({ path: z.string().min(1).max(1000) })

export default defineEventHandler(async (event) => {
  const { path } = await getValidatedQuery(event, schema)
  const account = await requireAccount(event)
  const moved = await withAccount(event, account => mailFor(account).deleteFolder(path))
  // A rule can't file into a folder that's gone
  const rules = await readStore<MailRule[]>(account, 'rules', [])
  if (rules.some(rule => rule.folder === path)) {
    await writeStore(account, 'rules', rules.filter(rule => rule.folder !== path))
  }
  return { moved }
})
