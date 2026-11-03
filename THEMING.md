# Theming CitrusMail

Everything you see is themeable, from the accent color down to the 2px edge on the selected message. There are five places to change it. Use the first one that covers what you need.

| Where | What it's for | Rebuild? |
| --- | --- | --- |
| `citrusmail` in `app/app.config.ts` | Your instance's look: colors, fonts, corners, surfaces, shadows, name and logo | Yes |
| `NUXT_PUBLIC_CITRUSMAIL_THEME` | The same keys as JSON, for Docker and other hosts | No |
| `NUXT_PUBLIC_BRAND_*` | Name, logo, favicon, sign-in text and image | No |
| `brand/custom.css` | Any CSS at all, loaded after everything else | No (read on each request) |
| `ui` in `app/app.config.ts` | Per-component styling: button variants, menu padding, modal size | Yes |
| Settings → Appearance | Each person's own accent, font, text size, corners and light/dark | No |

Values are applied in that order, so a person's Appearance choice wins over the environment variable, which wins over `app.config.ts`. `custom.css` is loaded last and can override all of them.

## 1. The theme object

`app/app.config.ts` holds the defaults:

```ts
export default defineAppConfig({
  citrusmail: {
    name: 'Acme Mail',
    logo: '/acme.svg',            // in public/; replaces the built-in mark
    allowAppearance: true,        // false hides Settings → Appearance
    theme: {
      primary: '#7c3aed',         // any hex, or a Tailwind palette name like 'violet'
      neutral: 'zinc',            // the greys: 'stone' | 'zinc' | 'slate' | 'gray' | 'neutral'
      unread: '',                 // the unread dot; empty uses the accent
      flag: '#f59e0b',
      font: "'Inter', ui-sans-serif, system-ui, sans-serif",
      fontSize: '16px',           // the root size every rem scales from
      radius: '0.375rem',         // buttons, fields, menus, dialogs
      sheetInset: '0.5rem',       // space around the page on wide screens; '0' = edge to edge
      sheetRadius: '0.75rem',
      sheetShadow: 'none',
      floatingShadow: '0 12px 32px -16px rgb(0 0 0 / 0.3)',
      light: { /* surface colors, see below */ },
      dark: { /* the same keys for dark mode */ }
    }
  }
})
```

Every value is a plain CSS value, so `color-mix()`, `var()`, gradients and multi-layer shadows all work. Only the keys you set change; everything else keeps its default.

A hex `primary` is treated as the button color, and CitrusMail mixes the lighter and darker shades from it. A Tailwind name uses Tailwind's own scale.

### Surface colors (`light` and `dark`)

| Key | Where it shows |
| --- | --- |
| `desk` | Behind the page: the sidebar and the sign-in panel |
| `sheet` | The page you read and write on |
| `elevated` | Hover states, menus, chips |
| `accented` | Active navigation items, switch tracks |
| `border` | Lines between rows and around fields |
| `sheetBorder` | The page's edge against the desk (`transparent` for none) |
| `text`, `textHighlighted`, `textMuted` | Body text, headings, secondary text |
| `selected`, `selectedEdge` | The selected message or contact, and its left edge |
| `overlay` | The dimmed backdrop behind a dialog |

The defaults are mixed from the `neutral` palette, so changing `neutral` re-tints every surface at once.

### Fonts

CitrusMail self-hosts its fonts through `@nuxt/fonts`, so no visitor's browser contacts Google. To use a new family, add it in two places:

1. `fonts.families` in `nuxt.config.ts`
2. `citrusmail.fonts` in `app.config.ts`, which lists the choices Settings → Appearance offers

A family is only downloaded when someone uses it.

## 2. Without a rebuild

Set `NUXT_PUBLIC_CITRUSMAIL_THEME` to JSON with any of the theme keys:

```bash
NUXT_PUBLIC_CITRUSMAIL_THEME='{"primary":"#0f766e","neutral":"slate","radius":"0","sheetInset":"0","dark":{"desk":"#000"}}'
```

### Name, logo and sign-in page

`NUXT_PUBLIC_BRAND_NAME`, `_LOGO`, `_LOGO_DARK`, `_FAVICON`, `_LOGIN_TITLE`, `_LOGIN_SUBTITLE` and `_LOGIN_IMAGE` (an image URL, or `none`) override the matching keys in `citrusmail` in `app.config.ts`. The README lists what each one does.

## 3. The brand folder and custom CSS

`brand/` (or the folder in `NUXT_BRAND_DIR`) is served at `/brand/` and read on every request, so its files can change while the server runs. Keep your logo, favicon and sign-in image there and point the `NUXT_PUBLIC_BRAND_*` variables at `/brand/<file>`. Images, fonts and CSS are served; other file types are not.

`brand/custom.css` is loaded after every other stylesheet.

Every theme value is a CSS custom property, so plain `:root` and `.dark` rules override it:

```css
:root {
  --ui-radius: 0;
  --lb-sheet-inset: 0;
  --lb-selected-edge: transparent;
}
.dark {
  --lb-desk: #000;
}
```

### The tokens

| Property | Set from |
| --- | --- |
| `--ui-color-primary-50` … `950`, `--ui-primary` | `primary` |
| `--font-sans`, `--lb-font-size` | `font`, `fontSize` |
| `--ui-radius` | `radius` |
| `--lb-desk`, `--ui-bg`, `--ui-bg-elevated`, `--ui-bg-accented`, `--ui-bg-muted` | `desk`, `sheet`, `elevated`, `accented` |
| `--ui-border`, `--lb-sheet-border` | `border`, `sheetBorder` |
| `--ui-text`, `--ui-text-highlighted`, `--ui-text-muted` | the text colors |
| `--lb-sheet-inset`, `--lb-sheet-radius`, `--lb-sheet-shadow` | the sheet keys |
| `--lb-shadow`, `--lb-overlay` | `floatingShadow`, `overlay` |
| `--lb-selected`, `--lb-selected-edge`, `--lb-unread`, `--lb-flag` | row and status colors |
| `--lb-avatar-1` … `6` and `--lb-avatar-N-text` | the tints behind initials (set in `main.css`) |

## 4. Component styling

CitrusMail is built only from [Nuxt UI](https://ui.nuxt.com) components, and each one can be restyled from the `ui` key in `app.config.ts`. These examples make every button pill-shaped and bold, and make dialogs wider:

```ts
ui: {
  button: {
    slots: { base: 'rounded-full font-semibold' }
  },
  modal: {
    slots: { content: 'sm:max-w-2xl' }
  }
}
```

Each component's page in the Nuxt UI docs lists its slots and variants under "Theme".

## 5. Per person

Settings → Appearance lets each person pick light or dark, an accent (presets or any color), a font from `citrusmail.fonts`, a text size and corner style. Their choices are saved with their account and follow them to other devices. Set `allowAppearance: false` to give everyone the instance's look.
