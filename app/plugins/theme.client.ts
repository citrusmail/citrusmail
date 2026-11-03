import colors from 'tailwindcss/colors'
import type { Appearance, CitrusMailTheme, ThemeOverride } from '~/utils/theme'

const BUILT_IN = new Set(Object.keys(colors))

/**
 * Applies the theme: app.config defaults, then NUXT_PUBLIC_CITRUSMAIL_THEME,
 * then the person's own Appearance choices (remembered in this browser so the
 * first paint is already right). Written as CSS custom properties
 */
export default defineNuxtPlugin(() => {
  const appConfig = useAppConfig()
  const config = useRuntimeConfig().public
  const pickTheme = (value?: ThemeOverride | string) => typeof value === 'string' ? value.trim() : value && Object.keys(value).length ? value : undefined
  const runtime = {
    theme: pickTheme((config.citrusmail as { theme?: ThemeOverride | string } | undefined)?.theme)
  }
  renameStoredKey('letterbox-appearance', 'citrusmail-appearance')
  const appearance = useLocalStorage<Appearance>('citrusmail-appearance', {})

  const envTheme = computed<ThemeOverride | undefined>(() => {
    const value = runtime.theme
    if (!value) return undefined
    if (typeof value === 'object') return value
    try {
      return JSON.parse(value) as ThemeOverride
    } catch {
      console.warn('[CitrusMail] NUXT_PUBLIC_CITRUSMAIL_THEME is not valid JSON')
      return undefined
    }
  })

  const theme = computed<CitrusMailTheme>(() => mergeTheme(
    appConfig.citrusmail.theme as CitrusMailTheme,
    envTheme.value,
    appConfig.citrusmail.allowAppearance ? appearance.value : undefined
  ))

  // Palette names go through Nuxt UI, which knows every Tailwind color; a hex
  // accent is mixed into a full scale by themeCss
  watchEffect(() => {
    const { primary, neutral } = theme.value
    if (!isHexColor(primary)) appConfig.ui.colors.primary = BUILT_IN.has(primary) ? primary : 'post'
    appConfig.ui.colors.neutral = neutral
  })

  useHead({
    style: [{ id: 'citrusmail-theme', innerHTML: () => themeCss(theme.value, BUILT_IN), tagPriority: 'low' }],
    // Loaded last, so brand/custom.css (served by server/routes/custom.css.ts) wins over everything
    link: [{ rel: 'stylesheet', href: '/custom.css', key: 'citrusmail-custom', tagPriority: 'low' }]
  })

  return { provide: { appearance, theme } }
})
