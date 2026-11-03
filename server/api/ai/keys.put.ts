import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const schema = z.object({
  provider: z.enum(['anthropic', 'openai', 'gemini', 'grok', 'perplexity']),
  // '' removes the key
  key: z.string().trim().max(400).regex(/^[\w.-]*$/, 'That doesn\'t look like an API key').optional(),
  model: z.string().trim().max(100).regex(/^[\w.:/-]*$/, 'That isn\'t a model name').optional(),
  /** Make this the provider AI features use */
  use: z.boolean().optional()
})

export default defineEventHandler(async (event): Promise<AiStatus> => {
  const { provider, key, model, use } = await readValidatedBody(event, schema)
  const account = await requireAccount(event)
  const saved = await readAiKeys(account)
  const current = saved[provider]
  // '' drops the provider; otherwise a new key or model replaces the old one
  const keys: AiKeys = Object.fromEntries(Object.entries(saved).filter(([name]) => name !== provider))
  if (key !== '' && (key || current)) keys[provider] = { key: key || current!.key, model: model !== undefined ? model || undefined : current?.model }
  await writeAiKeys(account, keys)

  if (use && keys[provider]) {
    const settings = await readStore<Partial<UserSettings>>(account, 'settings', {})
    await writeStore(account, 'settings', { ...DEFAULT_SETTINGS, ...settings, aiProvider: provider, updatedAt: Date.now() })
  }
  return aiStatus(account)
})
