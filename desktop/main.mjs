// CitrusMail for the desktop. The web app's own server (the Nuxt build in .output)
// runs inside this process on a local port, and one window shows it. Mail
// passwords still live only in the sealed session cookie, now in this app's
// own browser profile, and settings land in the app's data folder
import { app, BrowserWindow, nativeTheme, session, shell } from 'electron'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

// The brand folder this app was built with (CITRUSMAIL_BRAND_DIR at build
// time): its name, its servers, its images. See "Desktop app" in the README
const brandDir = app.isPackaged
  ? join(process.resourcesPath, 'brand')
  : resolve(process.env.CITRUSMAIL_BRAND_DIR || join(here, '..', 'brand'))

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

// app.env: KEY=value lines, the same variables a hosted instance takes. Only
// NUXT_ settings are read, so a brand can't switch off the app's own guards
function loadBrandEnv() {
  let text
  try {
    text = readFileSync(join(brandDir, 'app.env'), 'utf8')
  } catch {
    return
  }
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(NUXT_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!match || match[1] === 'NUXT_APP_SECRET') continue
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
}

loadBrandEnv()
const brand = readJson(join(brandDir, 'desktop.json'))
const appName = brand.productName || process.env.NUXT_PUBLIC_BRAND_NAME || 'CitrusMail'
const DEFAULT_PORT = 51730
const desktopToken = randomBytes(32).toString('hex')

const isOurs = (url) => {
  try {
    return new URL(url).origin === origin
  } catch {
    return false
  }
}

// Sign in with Microsoft happens on Microsoft's own pages, in this window,
// so the cookie that ties the attempt together and the app's header both
// reach the callback. Anything else still opens in the browser
const SIGN_IN_HOSTS = ['login.microsoftonline.com', 'login.live.com', 'login.microsoft.com', 'account.live.com', 'device.login.microsoftonline.com']
const isSignIn = (url) => {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && SIGN_IN_HOSTS.some(host => hostname === host || hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

// Before anything asks for userData: each brand keeps its own data folder
app.setName(appName)
if (!app.requestSingleInstanceLock()) app.quit()

// The port is kept between launches: the session cookie and the saved
// appearance belong to the origin, so a new port would sign you out
function loadConfig() {
  const file = join(app.getPath('userData'), 'desktop.json')
  let config = {}
  try {
    config = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    // First launch: nothing saved yet
  }
  config.sessionPassword ||= randomBytes(32).toString('hex')
  return { config, save: () => writeFileSync(file, JSON.stringify(config, null, 2), { mode: 0o600 }) }
}

function isFree(port) {
  return new Promise((resolve) => {
    const probe = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => probe.close(() => resolve(true)))
      .listen(port, '127.0.0.1')
  })
}

function anyPort() {
  return new Promise((resolve) => {
    const probe = createServer().listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

async function startServer() {
  const data = app.getPath('userData')
  mkdirSync(data, { recursive: true })
  const { config, save } = loadConfig()
  let port = config.port ?? DEFAULT_PORT
  if (!(await isFree(port))) port = await anyPort()
  config.port = port
  save()

  // The server keeps per-account settings in ./.data, so this puts them here
  process.chdir(data)
  process.env.NITRO_HOST = '127.0.0.1'
  process.env.NITRO_PORT = String(port)
  process.env.NUXT_APP_SECRET = config.sessionPassword
  // Mail servers on this Mac or your network are fine here (Proton Mail Bridge)
  process.env.CITRUSMAIL_DESKTOP = '1'
  // Only this app's window knows this, so nothing else on the Mac can use the server
  process.env.CITRUSMAIL_DESKTOP_TOKEN = desktopToken
  process.env.NUXT_BRAND_DIR = brandDir

  const entry = app.isPackaged
    ? join(process.resourcesPath, 'output', 'server', 'index.mjs')
    : join(here, '..', '.output', 'server', 'index.mjs')
  await import(pathToFileURL(entry).href)

  const origin = `http://127.0.0.1:${port}`
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(origin)
      return origin
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  throw new Error(`The mail server inside ${appName} did not start`)
}

let origin
let win
let quitting = false
app.on('before-quit', () => (quitting = true))

function openWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: appName,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1c1917' : '#f5f5f4',
    show: false,
    webPreferences: {
      preload: join(here, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      // Closed on a Mac, the window is only hidden and keeps checking for new
      // mail; throttled, those checks would slow to a crawl
      backgroundThrottling: false
    }
  })
  win.once('ready-to-show', () => win.show())

  // Links in messages open in the browser, never inside the app. The one
  // exception is the app's own server: an attachment link opens in a new tab
  // on the web, but a browser has neither the session cookie nor the secret
  // header, so here the app downloads it itself instead
  const external = url => /^(https?|mailto):/i.test(url) && shell.openExternal(url)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isOurs(url)) win.webContents.downloadURL(url)
    else external(url)
    return { action: 'deny' }
  })
  // Downloads land in the Downloads folder (a new name if taken) and the
  // Finder shows the file when it's done. No save dialog to click through
  win.webContents.session.on('will-download', (_event, item) => {
    const dir = app.getPath('downloads')
    const name = item.getFilename() || 'attachment'
    const [stem, ext] = name.match(/^(.*?)(\.[^.]*)?$/).slice(1)
    let path = join(dir, name)
    for (let n = 2; existsSync(path); n++) path = join(dir, `${stem} ${n}${ext || ''}`)
    item.setSavePath(path)
    item.once('done', (_e, state) => {
      if (state === 'completed') shell.showItemInFolder(path)
    })
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (isOurs(url) || isSignIn(url)) return
    event.preventDefault()
    external(url)
  })
  win.webContents.on('will-redirect', (event, url) => {
    if (!isOurs(url) && !isSignIn(url)) event.preventDefault()
  })
  // The message frame (about:srcdoc) can't be navigated anywhere either
  win.webContents.on('will-frame-navigate', (event) => {
    if (event.isMainFrame || isOurs(event.url) || event.url === 'about:srcdoc') return
    event.preventDefault()
    external(event.url)
  })

  // On a Mac, closing the window hides it, so new-mail notifications keep coming.
  // Quitting (Cmd+Q, the Dock or the tray) really closes it
  win.on('close', (event) => {
    if (quitting || process.platform !== 'darwin') return
    event.preventDefault()
    win.hide()
  })
  win.on('closed', () => (win = undefined))
  win.loadURL(`${origin}/mail/INBOX`)
}

app.on('second-instance', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
})

// On a Mac the app stays open with no windows, and the Dock icon reopens one
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (win) win.show()
  else if (origin) openWindow()
})

function lockDownSession() {
  const ses = session.defaultSession
  // The only permissions the app uses: copying text (hover-to-copy addresses)
  // and new-mail banners
  const allowed = new Set(['clipboard-sanitized-write', 'notifications'])
  ses.setPermissionRequestHandler((contents, permission, callback) => callback(allowed.has(permission) && isOurs(contents.getURL())))
  ses.setPermissionCheckHandler((contents, permission) => allowed.has(permission) && !!contents && isOurs(contents.getURL()))
  // The secret header only ever goes to the app's own server, never to an
  // image host a message points at
  ses.webRequest.onBeforeSendHeaders({ urls: [`${origin}/*`] }, (details, callback) => {
    callback({ requestHeaders: { ...details.requestHeaders, 'x-citrusmail-desktop': desktopToken } })
  })
}

app.on('web-contents-created', (_event, contents) => {
  // No <webview>, ever
  contents.on('will-attach-webview', event => event.preventDefault())
})

app.whenReady().then(async () => {
  origin = await startServer()
  lockDownSession()
  openWindow()
})
