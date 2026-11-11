# CitrusMail

An open-source mail, calendar and contacts client for any provider, built with [Nuxt 4](https://nuxt.com) and [Nuxt UI 4](https://ui.nuxt.com).

- **Mail** over IMAP, POP3 or [JMAP](#jmap), sending over SMTP (or through the JMAP server)
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

When the domain or its mail host also answers on `/.well-known/jmap`, CitrusMail signs in over JMAP, and falls back to IMAP if that doesn't work (see [JMAP](#jmap)).

If a provider needs an app password, the sign-in page says so and links to the page where you create one. Every setting can also be entered by hand under **Server settings**.

There is no database. The account settings, including the password, are stored in an encrypted, HTTP-only session cookie in your browser. Nothing is stored on the server.

## Run it

```bash
pnpm install
pnpm dev
```

`pnpm test` runs the unit tests (vitest), `pnpm lint` and `pnpm typecheck` the checks CI runs.

In production, set a secret for sealing sessions:

```bash
NUXT_APP_SECRET=$(openssl rand -base64 32)
pnpm build && node .output/server/index.mjs
```

It runs anywhere Nuxt runs, including Node, Docker, Vercel and Netlify. A long-running Node server keeps IMAP connections warm between requests, so it feels fastest there.

## Sign in with Microsoft

Microsoft 365 and Outlook.com mailboxes take no password from mail apps any more (their IMAP server answers `LOGINDISABLED`), so CitrusMail signs them in with Microsoft instead. That needs an app registration in [Microsoft Entra](https://entra.microsoft.com), once, about five minutes:

1. **Identity → Applications → App registrations → New registration.** Any name. Supported account types: *Accounts in any organizational directory and personal Microsoft accounts*.
2. **Authentication → Add a platform.** For a hosted copy, *Web* with the redirect URI `https://your-host/api/oauth/microsoft/callback`. For the desktop app, *Mobile and desktop applications* with `http://127.0.0.1:51730/api/oauth/microsoft/callback` (the port the app keeps). Set *Allow public client flows* to Yes.
3. **API permissions → Add → APIs my organization uses → Office 365 Exchange Online**, delegated: `IMAP.AccessAsUser.All` and `SMTP.Send`. Add `offline_access`, `openid`, `email` and `profile` from Microsoft Graph.
4. Copy the **Application (client) ID** and set it:

```bash
NUXT_OAUTH_MICROSOFT_CLIENT_ID=00000000-0000-0000-0000-000000000000
NUXT_OAUTH_MICROSOFT_CLIENT_SECRET=   # optional, from Certificates & secrets, for a hosted copy
NUXT_OAUTH_MICROSOFT_TENANT=common    # or your tenant id to allow one organization only
```

The sign-in page then shows **Sign in with Microsoft** for those addresses. The tokens live in the same encrypted cookie a password would, and are renewed on their own; after 90 days without use Microsoft asks to sign in again. Microsoft offers no CalDAV or CardDAV, so those mailboxes are mail only. In the desktop app, put the client id in the brand folder's `app.env`.

## JMAP

[JMAP](https://jmap.io) (RFC 8620 and RFC 8621) is a newer mail protocol over HTTPS and JSON. When CitrusMail finds a JMAP server for your address (at `/.well-known/jmap` on the domain or its mail host, or a `_jmap._tcp` SRV record), it signs in over JMAP with just your email and password, and falls back to IMAP if JMAP doesn't take them. The sign-in page says so, with a link to use IMAP instead.

- **Entering it yourself**: choose **JMAP** under **Server settings → Incoming** and type the server in one field: a name (`mail.example.com`, which means `https://mail.example.com/.well-known/jmap`), a URL with a port (`http://127.0.0.1:8080`) or the session URL itself (Fastmail: `https://api.fastmail.com/jmap/session`). A redirect is only followed on the same host, so the password never goes anywhere else.
- **Password or token**: type your password, an app password or an API token. CitrusMail tries it as a password (Basic auth), then as a token (Bearer), and remembers which worked. Fastmail's JMAP takes an API token, made under Settings → Privacy & Security → Manage API tokens. With an app password, Fastmail signs in over IMAP instead.
- **Sending**: when the server offers JMAP submission, mail goes out through it (EmailSubmission) and lands in Sent on its own, so SMTP settings are optional. Otherwise CitrusMail sends over the SMTP server under **Outgoing** and files a copy in Sent.
- **What works**: folders (create, rename, delete), the message list with search and filters, reading, attachments, the original message, read and flagged, move, delete (to Trash, or for good from Trash), drafts, AI search, new-mail notifications, sender allow and block lists, rules, read receipts and delivery reports, and settings that follow you (kept in an unsubscribed **CitrusMail Settings** mailbox, as over IMAP).
- **Subscriptions**: the subscriptions page reads the Inbox's List-Unsubscribe headers over JMAP too.
- **Switching between IMAP and JMAP**: rules and notification folders find their folders by name on the other protocol, so they keep working when an account moves to JMAP, or when one device uses IMAP and another JMAP on the same mailbox.
- **Not yet over JMAP**: JMAP push. Notifications use the minute-by-minute check.

Tested against [Stalwart](https://stalw.art) 1.1 and 0.11. It is written to the RFCs and should work with [Fastmail](https://www.fastmail.com) and [Cyrus IMAP](https://www.cyrusimap.org) 3.x, but they haven't been tested yet: reports are welcome.

To pin a JMAP server for everyone, set `NUXT_MAIL_JMAP_URL` (or `NUXT_MAIL_JMAP_HOST`), below.

## Lock it to your company's servers (optional)

Set these variables and people only enter an email and a password: the server settings, the connection card on the sign-in page and the calendar and contacts server fields are all hidden. They are read when the server starts, so no rebuild is needed.

| Variable | Example |
| --- | --- |
| `NUXT_MAIL_IMAP_HOST` / `_PORT` / `_SECURITY` | `imap.example.com` / `993` / `tls` |
| `NUXT_MAIL_POP3_HOST` / `_PORT` / `_SECURITY` | use instead of IMAP |
| `NUXT_MAIL_JMAP_URL`, or `NUXT_MAIL_JMAP_HOST` / `_PORT` / `_SECURITY` | `https://mail.example.com/.well-known/jmap`, use instead of IMAP. SMTP is then optional: it's only used if the server can't send |
| `NUXT_MAIL_SMTP_HOST` / `_PORT` / `_SECURITY` | `smtp.example.com` / `465` / `tls` |
| `NUXT_MAIL_CALDAV_URL` | `https://dav.example.com` |
| `NUXT_MAIL_CARDDAV_URL` | `https://dav.example.com` |
| `NUXT_MAIL_ALLOWED_DOMAINS` | `example.com,example.org` |

`SECURITY` is `tls`, `starttls` or `none` (for JMAP, `tls` is https and `none` is http). With `NUXT_MAIL_ALLOWED_DOMAINS` set, those domains' own servers are the only ones people can sign in to.

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

The same settings can be baked in with `citrusmail` in `app/app.config.ts`, and each person can still pick an accent, font, text size and corners in Settings → Appearance. See [THEMING.md](THEMING.md) for every theme key and CSS token.

## What CitrusMail stores

CitrusMail has no database. Your password lives only in an encrypted cookie in your browser. Signatures, rules, profile pictures and appearance choices are kept as one small JSON file per account in `.data/citrusmail`. The few secrets the server has to keep between visits (messages waiting to be sent later, AI keys and push subscriptions) are encrypted there with a key made from `NUXT_APP_SECRET` and a random key of its own, so neither the disk nor the environment alone can open them. To keep them somewhere else (Redis, S3, any [unstorage](https://unstorage.unjs.io) driver), change `nitro.storage.citrusmail` in `nuxt.config.ts`.

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
