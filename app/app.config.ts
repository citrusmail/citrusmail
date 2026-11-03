import type { CitrusMailTheme } from './utils/theme'

// Desk & Sheet: the app is a desk with one sheet of paper on it. Surfaces are
// separated by hairlines, never by shadows; only things that float over the
// sheet (menus, dialogs) get a single, short shadow so they read as lifted.
//
// Everything visual below `citrusmail.theme` is a plain CSS value and can be
// changed here, with NUXT_PUBLIC_CITRUSMAIL_THEME at runtime, or per person in
// Settings → Appearance. Component-level changes go in `ui`. See THEMING.md
const hairline = 'ring ring-default'
const floating = `bg-default ${hairline} shadow-(--lb-shadow)`
const overlay = 'bg-(--lb-overlay)'

/** Shorthand for a mix of two neutral shades, so a new `neutral` re-tints everything */
const n = (shade: number) => `var(--ui-color-neutral-${shade})`
const mix = (a: string, b: string, amount: number) => `color-mix(in oklab, ${a}, ${b} ${amount}%)`

const theme: CitrusMailTheme = {
  primary: 'post',
  neutral: 'stone',
  unread: '',
  flag: '#F59E0B',
  font: '\'Schibsted Grotesk\', ui-sans-serif, system-ui, sans-serif',
  fontSize: '16px',
  radius: '0.375rem',
  sheetInset: '0.5rem',
  sheetRadius: '0.75rem',
  sheetShadow: 'none',
  floatingShadow: '0 12px 32px -16px rgb(28 25 23 / 0.28)',
  light: {
    desk: mix(n(100), n(200), 22),
    sheet: '#ffffff',
    elevated: n(100),
    accented: n(200),
    border: n(200),
    sheetBorder: mix(n(900), 'transparent', 94),
    text: n(700),
    textHighlighted: n(900),
    textMuted: n(500),
    selected: mix('var(--ui-primary)', 'transparent', 92),
    selectedEdge: 'var(--ui-primary)',
    overlay: mix(n(950), 'transparent', 75)
  },
  dark: {
    desk: mix(n(950), n(900), 30),
    sheet: n(900),
    elevated: mix(n(900), n(800), 40),
    accented: mix(n(900), n(700), 45),
    border: mix(n(800), n(900), 30),
    sheetBorder: 'rgb(255 255 255 / 0.06)',
    text: n(200),
    textHighlighted: n(50),
    textMuted: n(400),
    selected: mix('var(--ui-primary)', 'transparent', 88),
    selectedEdge: 'var(--ui-primary)',
    overlay: 'rgb(0 0 0 / 0.5)'
  }
}

export default defineAppConfig({
  citrusmail: {
    /** Shown in the sidebar, the sign-in page and the browser tab */
    name: 'CitrusMail',
    /** A small line under the name; empty for none */
    byline: '',
    /** An image URL (e.g. '/logo.svg' in public/) to use instead of the built-in mark */
    logo: '',
    /** The logo for dark mode; empty uses `logo` */
    logoDark: '',
    /** The browser tab icon; empty uses /favicon.svg */
    favicon: '',
    /** The sign-in page headline and the line under it; empty uses the built-in text */
    loginTitle: '',
    loginSubtitle: '',
    /** An image URL for the sign-in page's right half instead of the connection card, or 'none' to hide that half */
    loginImage: '',
    /** Let each person pick their own accent, font, size and corners */
    allowAppearance: true,
    /** The fonts Settings → Appearance offers. Each needs an entry in nuxt.config `fonts.families` */
    fonts: [
      { label: 'Schibsted Grotesk', value: '\'Schibsted Grotesk\', ui-sans-serif, system-ui, sans-serif' },
      { label: 'Inter', value: '\'Inter\', ui-sans-serif, system-ui, sans-serif' },
      { label: 'IBM Plex Sans', value: '\'IBM Plex Sans\', ui-sans-serif, system-ui, sans-serif' },
      { label: 'Source Serif', value: '\'Source Serif 4\', ui-serif, Georgia, serif' },
      { label: 'System', value: 'ui-sans-serif, system-ui, -apple-system, \'Segoe UI\', sans-serif' }
    ],
    theme
  },
  ui: {
    colors: {
      primary: 'post',
      neutral: 'stone'
    },
    button: {
      slots: {
        base: 'font-medium'
      },
      compoundVariants: [{
        color: 'neutral',
        variant: 'outline',
        class: 'ring-default hover:bg-elevated'
      }, {
        color: 'neutral',
        variant: 'soft',
        class: 'bg-elevated hover:bg-accented/70'
      }, {
        color: 'neutral',
        variant: 'subtle',
        class: 'bg-default ring-default hover:bg-elevated'
      }, {
        color: 'neutral',
        variant: 'ghost',
        class: 'hover:bg-elevated active:bg-elevated'
      }, {
        // Up to 36px on a touch screen, a size a finger can land on
        size: ['sm', 'md'],
        square: true,
        class: {
          base: 'pointer-coarse:p-2',
          leadingIcon: 'pointer-coarse:size-5'
        }
      }]
    },
    badge: {
      slots: {
        base: 'font-medium'
      }
    },
    input: {
      slots: {
        root: 'w-full'
      }
    },
    inputMenu: {
      slots: {
        root: 'w-full',
        content: floating
      }
    },
    inputNumber: {
      slots: {
        root: 'w-full'
      }
    },
    textarea: {
      slots: {
        root: 'w-full'
      }
    },
    select: {
      slots: {
        base: 'w-full',
        content: floating
      }
    },
    selectMenu: {
      slots: {
        content: floating
      }
    },
    checkbox: {
      slots: {
        base: 'rounded-[4px]'
      }
    },
    commandPalette: {
      slots: {
        root: 'divide-default'
      }
    },
    contextMenu: {
      slots: {
        content: floating
      }
    },
    dropdownMenu: {
      slots: {
        content: floating
      }
    },
    popover: {
      slots: {
        content: floating
      }
    },
    tooltip: {
      slots: {
        content: 'bg-inverted text-inverted ring-0 shadow-none',
        kbds: '[&>*]:bg-white/15 [&>*]:text-inverted [&>*]:ring-0'
      }
    },
    kbd: {
      compoundVariants: [{
        color: 'neutral',
        variant: 'soft',
        class: 'bg-elevated text-muted'
      }]
    },
    inputDate: {
      slots: {
        base: 'gap-0!',
        segment: 'w-auto! px-0.5'
      },
      compoundVariants: [{
        color: 'primary',
        variant: 'none',
        class: {
          segment: 'focus:bg-primary focus:text-white'
        }
      }]
    },
    inputTime: {
      slots: {
        base: 'gap-0!',
        segment: 'w-auto! px-0.5'
      },
      compoundVariants: [{
        color: 'primary',
        variant: 'none',
        class: {
          segment: 'focus:bg-primary focus:text-white'
        }
      }]
    },
    modal: {
      slots: {
        content: `${floating} divide-default`,
        overlay
      },
      variants: {
        // A sheet with a gutter on a phone, the centered box above `sm`
        fullscreen: {
          false: {
            content: 'w-[calc(100vw-1rem)] h-[calc(100dvh-1rem)] sm:w-[calc(100vw-2rem)] sm:h-auto'
          }
        }
      },
      compoundVariants: [{
        fullscreen: false,
        scrollable: false,
        class: {
          content: 'max-h-none'
        }
      }]
    },
    navigationMenu: {
      slots: {
        link: 'font-medium before:rounded-md',
        linkLeadingIcon: 'size-[18px]'
      },
      compoundVariants: [{
        disabled: false,
        active: false,
        variant: 'pill',
        class: {
          link: 'text-toned hover:text-highlighted hover:before:bg-accented/60',
          linkLeadingIcon: 'text-muted group-hover:text-toned'
        }
      }, {
        active: true,
        variant: 'pill',
        highlight: false,
        class: {
          link: 'text-highlighted before:bg-accented/80',
          linkLeadingIcon: 'text-highlighted'
        }
      }]
    },
    sidebar: {
      slots: {
        body: 'p-2 gap-1',
        footer: 'p-2'
      }
    },
    slideover: {
      slots: {
        overlay,
        content: `${floating} divide-default`
      }
    },
    tabs: {
      variants: {
        variant: {
          pill: {
            list: 'bg-elevated rounded-md p-0.5',
            indicator: 'rounded-[5px]',
            trigger: 'rounded-[5px]'
          }
        }
      },
      compoundVariants: [{
        color: 'neutral',
        variant: 'pill',
        class: {
          indicator: 'bg-default ring ring-default shadow-none',
          trigger: 'data-[state=active]:text-highlighted text-muted hover:data-[state=inactive]:text-toned'
        }
      }]
    },
    toast: {
      slots: {
        root: floating
      }
    }
  }
})
