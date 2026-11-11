// Builds the desktop app. With CITRUSMAIL_BRAND_DIR pointing at a brand
// folder, the app is built as that brand instead: its own name, icon, app id
// and preconfigured mail servers (see "Desktop app" in the README)
const { existsSync, readFileSync } = require('node:fs')
const { join, resolve } = require('node:path')

const brandDir = resolve(process.env.CITRUSMAIL_BRAND_DIR || join(__dirname, '..', 'brand'))
if (!existsSync(brandDir)) throw new Error(`No brand folder at ${brandDir}`)

const desktop = existsSync(join(brandDir, 'desktop.json'))
  ? JSON.parse(readFileSync(join(brandDir, 'desktop.json'), 'utf8'))
  : {}
const productName = desktop.productName || 'CitrusMail'
const appId = desktop.appId || 'app.citrusmail.desktop'
if (!/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/i.test(appId)) throw new Error(`desktop.json appId "${appId}" is not a reverse-domain id like com.example.mail`)
const icon = existsSync(join(brandDir, 'icon.png')) ? join(brandDir, 'icon.png') : 'build/icon.png'

// Where installed apps look for updates (electron-updater reads the yml files
// published next to the installers). CitrusMail's own releases live on GitHub;
// a brand sets `updates` in desktop.json to publish its own, e.g.
// {"provider": "generic", "url": "https://downloads.acme.com/mail"}
const publish = desktop.updates || { provider: 'github', owner: 'citrusmail', repo: 'citrusmail' }

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId,
  productName,
  publish,
  // Keep in step with the electron devDependency
  electronVersion: '45.2.1',
  copyright: desktop.copyright || 'Copyright © 2026 CitrusMail contributors',
  directories: { output: '../dist-desktop', buildResources: 'build' },
  artifactName: `${productName.replace(/[^\w.-]+/g, '-')}-\${version}-\${arch}.\${ext}`,
  files: ['main.mjs', 'preload.cjs', 'package.json'],
  extraResources: [
    // The Nuxt server build, outside the asar so its own node_modules load as-is
    { from: '../.output', to: 'output' },
    // The brand: app.env, desktop.json, icon and images (served at /brand/)
    { from: brandDir, to: 'brand' }
  ],
  npmRebuild: false,
  // Turn off Electron features this app never uses, so the bundle can't be
  // run as a plain Node.js process or debugged from the command line
  electronFuses: {
    runAsNode: false,
    enableCookieEncryption: true,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true
  },
  mac: {
    category: 'public.app-category.productivity',
    icon,
    // Ad-hoc signed ("-") unless CSC_NAME / CSC_LINK name a Developer ID: the
    // fuses change the binary, and macOS kills an app whose signature no
    // longer matches. Ad-hoc builds need Open Anyway on other Macs
    identity: process.env.CSC_NAME || process.env.CSC_LINK ? undefined : '-',
    hardenedRuntime: true,
    // Notarized when Apple credentials are in the environment, for example
    // APPLE_KEYCHAIN_PROFILE from `xcrun notarytool store-credentials`
    notarize: !!(process.env.APPLE_KEYCHAIN_PROFILE || process.env.APPLE_API_KEY || process.env.APPLE_ID),
    target: [
      { target: 'dmg', arch: ['arm64', 'x64'] },
      { target: 'zip', arch: ['arm64', 'x64'] }
    ]
  },
  dmg: { title: productName },
  win: { icon, target: [{ target: 'nsis', arch: ['x64', 'arm64'] }] },
  nsis: { oneClick: true, perMachine: false },
  linux: { icon, category: 'Network;Email', target: ['AppImage', 'deb'] }
}
