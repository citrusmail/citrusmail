import { existsSync, renameSync } from 'node:fs'

// The data folder was called .data/letterbox before the app was renamed.
// Moves it once, before anything reads it, so signatures, rules and saved
// keys carry over. Only for the default folder on disk; another storage
// driver set in nuxt.config.ts is left alone
export default defineNitroPlugin(() => {
  if (existsSync('.data/letterbox') && !existsSync('.data/citrusmail')) {
    try {
      renameSync('.data/letterbox', '.data/citrusmail')
    } catch (error) {
      console.error('[CitrusMail] Could not move .data/letterbox to .data/citrusmail; move it by hand to keep your settings', error)
    }
  }
})
