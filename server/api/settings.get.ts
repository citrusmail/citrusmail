import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler(async (event): Promise<UserSettings> => {
  const account = await requireAccount(event)
  return { ...DEFAULT_SETTINGS, ...await readStore<Partial<UserSettings>>(account, 'settings', {}) }
})
