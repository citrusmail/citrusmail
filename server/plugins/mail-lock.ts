import { useRuntimeConfig } from 'nuxt/server'

// An instance with its mail server set in the environment is preconfigured:
// people only ever see email and password. The page's config is rebuilt from
// the environment on each request, so setting the variable here turns the
// sign-in page's server options off without a separate setting or a rebuild
export default defineNitroPlugin(() => {
  const mail = useRuntimeConfig().mail as { imap?: { host?: string }, pop3?: { host?: string }, jmap?: { host?: string, url?: string } }
  if (mail.imap?.host || mail.pop3?.host || mail.jmap?.host || mail.jmap?.url) process.env.NUXT_PUBLIC_MAIL_LOCKED = 'true'
})
