type BrandKey = 'name' | 'byline' | 'logo' | 'logoDark' | 'favicon' | 'loginTitle' | 'loginSubtitle' | 'loginImage'
  | 'credit' | 'creditUrl' | 'source' | 'license'

/**
 * The instance's brand: `citrusmail` in app.config.ts, overridden at runtime by
 * NUXT_PUBLIC_BRAND_* (no rebuild). For the byline, credit, source and
 * license, 'none' hides what app.config.ts would show
 */
export function useBrand() {
  const appConfig = useAppConfig()
  const config = useRuntimeConfig().public
  const env = config.brand as Partial<Record<BrandKey, string>> | undefined
  const locked = !!(config.mail as { locked?: boolean } | undefined)?.locked

  return computed(() => {
    const base = appConfig.citrusmail
    const pick = (key: BrandKey) => {
      const value = env?.[key]?.trim()
      if (value?.toLowerCase() === 'none') return ''
      return value || base[key] || ''
    }
    const name = pick('name')
    // Renamed at runtime: the credit then says what it's built on, not that it's ours
    const renamed = name !== base.name
    // The built-in byline belongs to the built-in name: a renamed instance only shows its own
    const byline = env?.byline?.trim() ? pick('byline') : renamed ? '' : base.byline
    return {
      name,
      // Left out where the name already says it ("Acme Mail" by Acme)
      byline: byline && name.toLowerCase().includes(byline.replace(/^by\s+/i, '').toLowerCase()) ? '' : byline,
      logo: pick('logo'),
      logoDark: pick('logoDark'),
      favicon: pick('favicon'),
      loginTitle: pick('loginTitle') || (locked ? `Sign in to ${name}` : 'Sign in with the email you already have'),
      loginSubtitle: pick('loginSubtitle') || (locked
        ? `Use your ${name} email address and password.`
        : `Gmail, iCloud, Fastmail, your company’s server or any other IMAP account. ${name} looks up the settings for you.`),
      loginImage: pick('loginImage'),
      /** Who makes it, and what a renamed instance is built on (empty when not) */
      credit: pick('credit'),
      creditUrl: pick('creditUrl'),
      builtOn: renamed && !env?.credit?.trim() ? base.name : '',
      source: pick('source'),
      license: pick('license')
    }
  })
}
