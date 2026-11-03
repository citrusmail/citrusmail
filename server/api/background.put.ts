import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

// The picture behind the app, resized in the browser first. Kept apart from
// the other settings so they stay small; '' removes it
const schema = z.object({
  image: z.union([
    z.literal(''),
    z.string().max(6 * 1024 * 1024).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'That picture couldn\'t be read')
  ])
})

export default defineEventHandler(async (event) => {
  const { image } = await readValidatedBody(event, schema)
  const account = await requireAccount(event)
  await writeStore(account, 'background', { image })
  return { ok: true as const }
})
