# CitrusMail

An open-source mail, calendar and contacts client for any provider, built with [Nuxt 4](https://nuxt.com) and [Nuxt UI 4](https://ui.nuxt.com).

- **Mail** over IMAP or POP3, sending over SMTP
- **Calendar** over CalDAV, using the [Nuxt UI calendar template](https://github.com/nuxt-ui-templates/calendar): day, week, month and year views, drag and drop, and quick events
- **Contacts** over CardDAV
- **Composer** built on the Nuxt UI `UEditor`, adapted from the [editor template](https://github.com/nuxt-ui-templates/editor), with send later
- **Read receipts**: Delivered, Opened or Bounced on the messages you track
- **AI** with your own key for Anthropic (Claude), OpenAI, Google Gemini, xAI Grok or Perplexity: summaries, AI Reply, and questions across your mail
- **Translation** of messages you receive and replies you write
- **Signatures** for each mailbox you send from, written in the app or pasted as HTML
- **Notifications** for new mail, and one-click unsubscribe

## Three ways to use it

| | Who sets up the mail servers | What people see at sign-in |
| --- | --- | --- |
| **The open template** (`pnpm dev`) | Nobody: CitrusMail looks them up from the address | Email and password, plus optional server settings |
| **On your website** | You, once, in the environment ([below](#lock-it-to-your-companys-servers-optional)) | Email and password only |
| **Your own desktop app** | You, in a brand folder, before you build ([below](#desktop-app)) | Email and password only |

Set a mail server in the environment and every server option disappears from the app: the sign-in page asks only for an email and a password, and Settings has no server fields.

## Sign in with an email and a password

There is nothing to configure. Type your address, and CitrusMail finds the servers in this order:

1. Built-in settings for Gmail, iCloud, Outlook, Yahoo, Fastmail, Zoho, GMX, Yandex and Proton Bridge
2. The domain's own autoconfig file, then Thunderbird's ISP database (also looked up by MX, so Google Workspace and Microsoft 365 domains work)
3. DNS SRV records (RFC 6186 for mail, RFC 6764 for CalDAV and CardDAV)
4. Common hostnames such as `imap.example.com`, probed before they are used

If a provider needs an app password, the sign-in page says so and links to the page where you create one. Every setting can also be entered by hand under **Server settings**.

There is no database. The account settings, including the password, are stored in an encrypted, HTTP-only session cookie in your browser. Nothing is stored on the server.

## Run it

```bash
pnpm install
pnpm dev
```

In production, set a secret for sealing sessions:

```bash
NUXT_APP_SECRET=$(openssl rand -base64 32)
pnpm build && node .output/server/index.mjs
```

It runs anywhere Nuxt runs, including Node, Docker, Vercel and Netlify. A long-running Node server keeps IMAP connections warm between requests, so it feels fastest there.

## Lock it to your company's servers (optional)

Set these variables and people only enter an email and a password: the server settings, the connection card on the sign-in page and the calendar and contacts server fields are all hidden. They are read when the server starts, so no rebuild is needed.

| Variable | Example |
| --- | --- |
| `NUXT_MAIL_IMAP_HOST` / `_PORT` / `_SECURITY` | `imap.example.com` / `993` / `tls` |
| `NUXT_MAIL_POP3_HOST` / `_PORT` / `_SECURITY` | use instead of IMAP |
| `NUXT_MAIL_SMTP_HOST` / `_PORT` / `_SECURITY` | `smtp.example.com` / `465` / `tls` |
| `NUXT_MAIL_CALDAV_URL` | `https://dav.example.com` |
| `NUXT_MAIL_CARDDAV_URL` | `https://dav.example.com` |
| `NUXT_MAIL_ALLOWED_DOMAINS` | `example.com,example.org` |

`SECURITY` is `tls`, `starttls` or `none`. With `NUXT_MAIL_ALLOWED_DOMAINS` set, those domains' own servers are the only ones people can sign in to.

### Other settings

| Variable | What it does |
| --- | --- |
| `NUXT_APP_SECRET` | **Required.** At least 32 random characters, used to encrypt the session cookie: `openssl rand -base64 32` |
| `NUXT_MAIL_ALLOW_PRIVATE_HOSTS` | `true` if your mail server is on a private network. Off by default, so the server can't be pointed at internal machines |
| `NUXT_TRUST_PROXY` | `true` behind a reverse proxy, so rate limits see each visitor's address |
| `NUXT_FAIVELO_URL` | `https://faivelo.com` to let [Faivelo](https://faivelo.com) mailboxes have Faivelo track their opens. Off by default |

## Make it yours

Run your own copy under your own name without forking: everything below is read when the server starts, so a Docker or `.env` change is enough.

| Variable | What it sets |
| --- | --- |
| `NUXT_PUBLIC_BRAND_NAME` | The app's name: sidebar, sign-in page, browser tab |
| `NUXT_PUBLIC_BRAND_BYLINE` | A small line under the name, e.g. `by Acme` (none by default) |
| `NUXT_PUBLIC_BRAND_LOGO` | A square logo image in place of the citrus mark, e.g. `/brand/logo.svg` |
| `NUXT_PUBLIC_BRAND_LOGO_DARK` | The logo for dark mode (optional) |
| `NUXT_PUBLIC_BRAND_FAVICON` | The browser tab icon, e.g. `/brand/favicon.svg` |
| `NUXT_PUBLIC_BRAND_LOGIN_TITLE` | The sign-in page headline |
| `NUXT_PUBLIC_BRAND_LOGIN_SUBTITLE` | The line under it |
| `NUXT_PUBLIC_BRAND_LOGIN_IMAGE` | An image for the sign-in page's right half, or `none` for a single centered column |
| `NUXT_PUBLIC_CITRUSMAIL_THEME` | Colors, fonts, corners, surfaces and shadows as JSON, e.g. `{"primary":"#7c3aed","radius":"0"}` |
| `NUXT_BRAND_DIR` | The folder served at `/brand/` (default `./brand`) |

Put your images and a `custom.css` in the brand folder (in Docker, mount it at `/app/brand` or set `NUXT_BRAND_DIR`). Files there are read on each request, so they can change without a rebuild. `custom.css` loads after everything else and can restyle anything, the sign-in page included.

The same settings can be baked in with `letterbox` in `app/app.config.ts`, and each person can still pick an accent, font, text size and corners in Settings → Appearance. See [THEMING.md](THEMING.md) for every theme key and CSS token.

## What CitrusMail stores

CitrusMail has no database. Your password lives only in an encrypted cookie in your browser. Signatures, rules, profile pictures and appearance choices are kept as one small JSON file per account in `.data/letterbox`. The few secrets the server has to keep between visits (messages waiting to be sent later, AI keys and push subscriptions) are encrypted there with a key made from `NUXT_APP_SECRET` and a random key of its own, so neither the disk nor the environment alone can open them. To keep them somewhere else (Redis, S3, any [unstorage](https://unstorage.unjs.io) driver), change `nitro.storage.letterbox` in `nuxt.config.ts`.

## Keyboard

Press `?` anywhere in the app to see every shortcut. The main ones:

| Mail | | Calendar | |
| --- | --- | --- | --- |
| `c` | New message | `d` `w` `m` `y` | Day, week, month, year |
| `j` / `k` | Next / previous | `t` | Today |
| `r` / `a` / `f` | Reply / all / forward | `n` | New event |
| `e` / `#` | Archive / delete | `⌘K` | Search events |
| `⌘↵` | Send | `←` / `→` | Previous / next |

## Privacy and security

- Message HTML is sanitized on the server and shown in a sandboxed frame that can't run scripts, with a Content-Security-Policy of its own.
- Remote images are blocked until you choose to show them, so senders can't tell when you open a message.
- Passwords are never written to logs or error messages. The session cookie is encrypted, `HttpOnly`, and lasts a week.
- The server refuses cross-site requests, form posts and oversized bodies, and every route except signing in needs a session.
- It won't connect to private or loopback addresses unless you allow it, and it pins each connection to the address it checked, so DNS can't redirect it.
- Sign-in attempts are rate-limited per address and per mailbox.

Found a security problem? Please report it privately, as described in [SECURITY.md](SECURITY.md), rather than in a public issue.

## License

The code is [MIT](LICENSE): use it, change it and ship it, commercially or not.

The license covers the code, not the CitrusMail name or the citrus logo. If you give your copy to other people, give it your own name and logo (see [Make it yours](#make-it-yours) and [Build it as your own app](#build-it-as-your-own-app)), so nobody mistakes it for the official CitrusMail. Running it for yourself under the original name is fine.

## Desktop app

CitrusMail runs as a desktop app for Mac, Windows and Linux. The app runs the same server inside itself on a local port, so nothing else needs to be running.

```bash
pnpm desktop               # build, then open the app from source
pnpm desktop:build         # the Mac .dmg and .zip, in dist-desktop/
pnpm desktop:build:win     # a Windows installer
pnpm desktop:build:linux   # an AppImage and a .deb
```

### Build it as your own app

Make a brand folder:

```
my-brand/
  desktop.json   {"productName": "Acme Mail", "appId": "com.acme.mail", "copyright": "Copyright © 2026 Acme"}
  app.env        the same variables as a hosted copy, one per line
  icon.png       1024 × 1024, used for the app icon
  logo.svg       any images app.env points at, served at /brand/
```

A typical `app.env`:

```bash
NUXT_PUBLIC_BRAND_NAME=Acme Mail
NUXT_PUBLIC_BRAND_LOGO=/brand/logo.svg
NUXT_PUBLIC_CITRUSMAIL_THEME={"primary":"#0c50ff"}
NUXT_MAIL_IMAP_HOST=mail.acme.com
NUXT_MAIL_IMAP_PORT=993
NUXT_MAIL_IMAP_SECURITY=tls
NUXT_MAIL_SMTP_HOST=mail.acme.com
NUXT_MAIL_SMTP_PORT=587
NUXT_MAIL_SMTP_SECURITY=starttls
```

Then build with the folder:

```bash
CITRUSMAIL_BRAND_DIR=../my-brand pnpm desktop:build
```

The result is `Acme Mail.app`, with its own icon, its own data folder and your servers set, so people only ever type their email and password. Everything in the brand folder ships inside the app and can be read by anyone who has it, so put only server names there, never a password or key. The app makes its own session secret on first launch, and `NUXT_APP_SECRET` in `app.env` is ignored.

### Signing

Without a certificate the Mac build is ad-hoc signed, and the first time someone opens it they right-click the app and choose Open. To sign and notarize, set `CSC_LINK` (or `CSC_NAME`) and the `APPLE_ID` variables [electron-builder reads](https://www.electron.build/code-signing) before `pnpm desktop:build`.
