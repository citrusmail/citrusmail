// Sessions (and with them every signed-in mailbox) are sealed with
// NUXT_APP_SECRET. Without it a production server can't sign anyone in, so it
// says so at startup instead of failing each request with a bare error.
// In development Nuxt makes one up and keeps it in .nuxt
export default defineNitroPlugin(() => {
  if (import.meta.dev) return
  const secret = String(useRuntimeConfig().appSecret ?? '')
  if (secret.length >= 32) return
  const problem = secret ? 'is shorter than 32 characters' : 'is not set'
  throw new Error(`[CitrusMail] NUXT_APP_SECRET ${problem}. It encrypts the session cookies that hold each signed-in mailbox. Create one with \`openssl rand -base64 32\` and set it in the environment before starting the server.`)
})
