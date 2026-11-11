import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const ruleSchema = z.object({
  id: z.string().min(1).max(64),
  enabled: z.boolean(),
  match: z.enum(['all', 'any']),
  conditions: z.array(z.object({
    field: z.enum(['from', 'to', 'subject']),
    value: z.string().trim().min(1, 'Fill in every condition').max(200)
  })).min(1).max(10),
  folder: z.string().trim().min(1, 'Choose a folder').max(1000),
  markRead: z.boolean(),
  createFolder: z.boolean().optional(),
  applyToExisting: z.boolean().optional()
})

const schema = z.object({ rules: z.array(ruleSchema).max(100) })

// Saves the whole list. A rule can name a folder that doesn't exist yet, which
// is created here, and a new rule leaves older Inbox mail alone unless asked
export default defineEventHandler(async (event) => {
  const { rules } = await readValidatedBody(event, schema)
  const account = await requireAccount(event)
  const previous = new Map((await readStore<MailRule[]>(account, 'rules', [])).map(rule => [rule.id, rule]))

  const saved = await withAccount(event, async (account) => {
    const mail = mailFor(account)
    let folders = await mail.listFolders()
    const existing = new Set(folders.map(folder => folder.path))
    const result: MailRule[] = []
    for (const { createFolder, applyToExisting, ...rule } of rules) {
      let folder = rule.folder
      if (createFolder && !existing.has(folder)) {
        folder = await mail.createFolder(folderName.parse(folder))
        existing.add(folder)
      }
      const before = previous.get(rule.id)
      const after = applyToExisting ? undefined : before ? before.after : await inboxMark(account)
      result.push({ ...rule, folder, after })
    }
    // Each rule keeps its folder's full name too, for devices on the other protocol
    if (result.some(rule => !folders.some(folder => folder.path === rule.folder))) folders = await mail.listFolders()
    return result.map((rule) => {
      const folder = folders.find(entry => entry.path === rule.folder)
      return { ...rule, folderName: folder ? folderFullName(folder) : previous.get(rule.id)?.folderName }
    })
  })

  await writeStore(account, 'rules', saved)
  const moved = await runRules(account, true).catch(() => 0)
  return { rules: saved, moved }
})
