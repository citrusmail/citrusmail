import pkg from './package.json'
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt',
    'nuxt-auth-utils'
  ],

  // A mail client lives behind a sign-in, there is nothing to pre-render
  ssr: false,

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  ui: {
    experimental: {
      componentDetection: true
    }
  },

  // Every mail setting is optional. Set NUXT_MAIL_IMAP_HOST (or POP3) and
  // NUXT_MAIL_SMTP_HOST to pin a company's servers: users then only type an
  // email and password, and the UI hides the Advanced panel
  runtimeConfig: {
    session: {
      // The cookie holds the mail password and can't be revoked server-side,
      // so it lasts a week rather than a month
      maxAge: 60 * 60 * 24 * 7
    },
    // NUXT_TRUST_PROXY=true behind a reverse proxy, so rate limits see each visitor
    trustProxy: false,
    // NUXT_FAIVELO_URL=https://faivelo.com lets Faivelo mailboxes have Faivelo
    // track their opens (Settings → Tracking). Empty, the default, leaves it off
    faiveloUrl: '',
    // Sign in with Microsoft (NUXT_OAUTH_MICROSOFT_CLIENT_ID, _CLIENT_SECRET, _TENANT):
    // Microsoft 365 and Outlook.com mailboxes only accept OAuth, see README
    oauth: {
      microsoft: { clientId: '', clientSecret: '', tenant: 'common' }
    },
    mail: {
      imap: { host: '', port: 0, security: '' },
      pop3: { host: '', port: 0, security: '' },
      smtp: { host: '', port: 0, security: '' },
      caldavUrl: '',
      carddavUrl: '',
      allowedDomains: '',
      // NUXT_MAIL_ALLOW_PRIVATE_HOSTS=true when your mail server is on a private
      // network. Off by default so the server can't be pointed at internal machines
      allowPrivateHosts: false
    },
    public: {
      /** Shown in Settings → About */
      version: pkg.version,
      // NUXT_PUBLIC_CITRUSMAIL_THEME: a JSON theme override, e.g. '{"primary":"#7c3aed","radius":"0"}'.
      // Same keys as `citrusmail.theme` in app.config.ts; no rebuild needed
      citrusmail: {
        theme: {}
      },
      // Your instance's brand, at runtime: NUXT_PUBLIC_BRAND_NAME, _BYLINE, _LOGO, _LOGO_DARK,
      // _FAVICON, _LOGIN_TITLE, _LOGIN_SUBTITLE, _LOGIN_IMAGE, _CREDIT, _CREDIT_URL, _SOURCE,
      // _LICENSE. Empty keeps app.config.ts; 'none' hides a byline, credit, source or license
      brand: {
        name: '',
        byline: '',
        logo: '',
        logoDark: '',
        favicon: '',
        loginTitle: '',
        loginSubtitle: '',
        loginImage: '',
        credit: '',
        creditUrl: '',
        source: '',
        license: ''
      },
      mail: {
        // True when the mail server is set in the environment (server/plugins/mail-lock.ts
        // also checks at startup, so no rebuild is needed); then people only see email + password
        locked: Boolean(process.env.NUXT_MAIL_IMAP_HOST || process.env.NUXT_MAIL_POP3_HOST)
      }
    }
  },

  experimental: {
    viewTransition: true
  },

  compatibilityDate: '2026-06-30',

  // Signatures and rules are the only things CitrusMail keeps itself, one small
  // JSON file per account. Point this at Redis, S3 or any unstorage driver to
  // run on a host without a disk
  nitro: {
    storage: {
      citrusmail: { driver: 'fs', base: './.data/citrusmail' }
    }
  },

  vite: {
    optimizeDeps: {
      include: ['date-fns', 'gpu-time', '@internationalized/date']
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  // `--font-sans` leads with `-apple-system` so Apple platforms use SF Pro, and
  // @nuxt/fonts only resolves the first family in a stack, so Inter is declared
  // here to get its `@font-face` emitted for everyone else
  fonts: {
    // Self-hosted at build time. A face is only downloaded when it's in use,
    // so the Appearance choices cost nothing until someone picks one
    families: [
      { name: 'Schibsted Grotesk', provider: 'google', global: true, weights: [400, 500, 600, 700, 800] },
      { name: 'Inter', provider: 'google', global: true, weights: [400, 500, 600, 700] },
      { name: 'IBM Plex Sans', provider: 'google', global: true, weights: [400, 500, 600, 700] },
      { name: 'Source Serif 4', provider: 'google', global: true, weights: [400, 500, 600, 700] }
    ]
  },

  // Icons outside the client bundle are fetched from the server on first
  // render, which the offline badge's `i-lucide-cloud-off` only does once the
  // network is gone. Scanning inlines every icon the app references, so it
  // ships with the bundle and the fetch never happens
  icon: {
    clientBundle: {
      scan: true,
      // Named in app/utils/ai-logos.ts, which the scan doesn't read
      icons: ['simple-icons:claude', 'simple-icons:openai', 'simple-icons:googlegemini', 'simple-icons:x', 'simple-icons:perplexity']
    }
  }
})
