type BrandKey = 'name' | 'byline' | 'logo' | 'logoDark' | 'favicon' | 'loginTitle' | 'loginSubtitle' | 'loginImage'

/**
 * The instance's brand: `letterbox` in app.config.ts, overridden at runtime by
 * NUXT_PUBLIC_BRAND_* (no rebuild)
 */
export function useBrand() {
  const appConfig = useAppConfig()
  const config = useRuntimeConfig().public
  const env = config.brand as Partial<Record<BrandKey, string>> | undefined
  const locked = !!(config.mail as { locked?: boolean } | undefined)?.locked

  return computed(() => {
    const base = appConfig.letterbox
    const pick = (key: BrandKey) => env?.[key]?.trim() || base[key] || ''
    const name = pick('name')
    const byline = pick('byline')
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
      loginImage: pick('loginImage')
    }
  })
}
