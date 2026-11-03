import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const schema = z.object({
  name: folderName,
  parent: z.string().min(1).max(1000).optional()
})

export default defineEventHandler(async (event) => {
  const { name, parent } = await readValidatedBody(event, schema)
  const path = await withAccount(event, account => mailFor(account).createFolder(name, parent))
  return { path }
})
