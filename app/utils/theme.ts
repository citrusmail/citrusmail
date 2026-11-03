/**
 * Letterbox's look, as data. Every value is a CSS value (a color, a length, a
 * shadow, a font stack), so anything CSS can do is allowed. Defaults live in
 * `app/app.config.ts`; `NUXT_PUBLIC_CITRUSMAIL_THEME` (JSON) overrides them
 * without a rebuild; each person's Appearance settings go on top of both.
 * See THEMING.md.
 */
export interface ThemeColors {
  /** The app behind the sheet: sidebar, sign-in panel */
  desk: string
  /** The page everything is read and written on */
  sheet: string
  /** Hover and raised surfaces: menus, pressed buttons, chips */
  elevated: string
  /** One step stronger than elevated: active nav items, tracks */
  accented: string
  /** Hairlines between rows, around fields and cards */
  border: string
  /** The edge of the sheet against the desk; 'transparent' for none */
  sheetBorder: string
  /** Body text, headings and secondary text */
  text: string
  textHighlighted: string
  textMuted: string
  /** A selected message or contact row */
  selected: string
  /** The 2px edge on the selected row; 'transparent' for none */
  selectedEdge: string
  /** Behind a dialog */
  overlay: string
}

export interface LetterboxTheme {
  /** Accent: a hex color, or a Tailwind palette name such as 'violet' */
  primary: string
  /** Greys: a Tailwind palette name ('stone', 'zinc', 'slate', 'gray', 'neutral') */
  neutral: string
  /** The unread dot; defaults to the accent */
  unread: string
  /** Flags */
  flag: string
  /** Font stack for everything. Add the family to `fonts.families` in nuxt.config to self-host it */
  font: string
  /** The root size every rem scales from: '15px' is compact, '17px' roomy */
  fontSize: string
  /** Corners of buttons, fields, menus and dialogs */
  radius: string
  /** Space around the sheet on wide screens; '0' puts it edge to edge */
  sheetInset: string
  sheetRadius: string
  sheetShadow: string
  /** Under menus, popovers, dialogs and toasts */
  floatingShadow: string
  light: ThemeColors
  dark: ThemeColors
}

/** What a person can change for themselves in Settings → Appearance */
export interface Appearance {
  primary?: string
  font?: string
  fontSize?: string
  radius?: string
}

export type ThemeOverride = Partial<Omit<LetterboxTheme, 'light' | 'dark'>> & {
  light?: Partial<ThemeColors>
  dark?: Partial<ThemeColors>
}

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const

/** A hex accent is the shade buttons use (600); the rest are mixed from it */
const MIX: Record<(typeof SHADES)[number], string> = {
  50: 'white 93%', 100: 'white 86%', 200: 'white 72%', 300: 'white 52%', 400: 'white 30%', 500: 'white 14%',
  600: '', 700: 'black 18%', 800: 'black 34%', 900: 'black 48%', 950: 'black 66%'
}

export function isHexColor(value?: string): value is string {
  return !!value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

export function mergeTheme(base: LetterboxTheme, ...overrides: (ThemeOverride | undefined)[]): LetterboxTheme {
  return overrides.reduce<LetterboxTheme>((theme, override) => {
    if (!override || typeof override !== 'object') return theme
    const clean = Object.fromEntries(Object.entries(override).filter(([, value]) => value !== undefined && value !== ''))
    return {
      ...theme,
      ...clean,
      light: { ...theme.light, ...override.light },
      dark: { ...theme.dark, ...override.dark }
    }
  }, base)
}

function colorVars(colors: ThemeColors) {
  return {
    '--lb-desk': colors.desk,
    '--lb-desk-solid': colors.desk,
    '--ui-bg-muted': colors.desk,
    '--ui-bg': colors.sheet,
    '--ui-bg-elevated': colors.elevated,
    '--ui-bg-accented': colors.accented,
    '--ui-border': colors.border,
    '--ui-border-muted': colors.border,
    '--lb-sheet-border': colors.sheetBorder,
    '--ui-text': colors.text,
    '--ui-text-highlighted': colors.textHighlighted,
    '--ui-text-muted': colors.textMuted,
    '--lb-selected': colors.selected,
    '--lb-selected-edge': colors.selectedEdge,
    '--lb-overlay': colors.overlay
  }
}

const block = (selector: string, vars: Record<string, string | undefined>) =>
  `${selector} {\n${Object.entries(vars).filter(([, value]) => value).map(([name, value]) => `  ${name}: ${value};`).join('\n')}\n}`

/** The whole theme as CSS custom properties, light and dark */
export function themeCss(theme: LetterboxTheme, builtInPalettes: Set<string>): string {
  const shades = (value: (shade: number) => string) => Object.fromEntries(SHADES.map(shade => [`--ui-color-primary-${shade}`, value(shade)]))
  // A hex is mixed into a scale; a palette of our own (declared with @theme in
  // main.css, like 'post') is spelled out, since Nuxt UI only resolves
  // Tailwind's built-in names, which it handles itself
  const accent = isHexColor(theme.primary)
    ? shades(shade => MIX[shade as keyof typeof MIX] ? `color-mix(in oklab, ${theme.primary}, ${MIX[shade as keyof typeof MIX]})` : theme.primary)
    : builtInPalettes.has(theme.primary) ? {} : shades(shade => `var(--color-${theme.primary}-${shade})`)

  // Plain :root and .dark, so brand/custom.css (loaded after) can override any of it
  return [
    block(':root', {
      ...accent,
      '--font-sans': theme.font,
      '--lb-font-size': theme.fontSize,
      '--ui-radius': theme.radius,
      '--lb-sheet-inset': theme.sheetInset,
      '--lb-sheet-radius': theme.sheetRadius,
      '--lb-sheet-shadow': theme.sheetShadow,
      '--lb-shadow': theme.floatingShadow,
      '--lb-flag': theme.flag,
      '--lb-unread': theme.unread || 'var(--ui-primary)',
      '--ui-primary': 'var(--ui-color-primary-600)',
      ...colorVars(theme.light)
    }),
    block('.dark', {
      '--ui-primary': 'var(--ui-color-primary-400)',
      ...colorVars(theme.dark)
    })
  ].join('\n')
}
