import { createHash } from 'node:crypto'
import webpush from 'web-push'
import type { PushSubscription } from 'web-push'

/**
 * Push notifications reach a browser even when CitrusMail is closed. To know
 * there's new mail, this server checks for you, so each subscription keeps
 * the mailboxes it was made for, sealed (vault.ts). Turning push off, or
 * signing out of that browser, deletes it
 */
interface StoredPush {
  subscription: PushSubscription
  /** Sealed AccountSettings[] */
  accounts: string
  cursors: Record<string, Record<string, number>>
  /** IANA time zone, for quiet hours */
  timeZone: string
}

const PREFIX = 'push:sub:'
const subKey = (endpoint: string) => `${PREFIX}${createHash('sha256').update(endpoint).digest('hex').slice(0, 40)}`

let vapid: { publicKey: string, privateKey: string } | undefined

export async function vapidKeys() {
  if (vapid) return vapid
  const storage = useStorage('letterbox')
  vapid = await storage.getItem<{ publicKey: string, privateKey: string }>('push:vapid') ?? undefined
  if (!vapid) {
    vapid = webpush.generateVAPIDKeys()
    await storage.setItem('push:vapid', vapid)
  }
  return vapid
}

export async function savePush(subscription: PushSubscription, accounts: AccountSettings[], timeZone: string) {
  const storage = useStorage('letterbox')
  const current = await storage.getItem<StoredPush>(subKey(subscription.endpoint))
  await storage.setItem(subKey(subscription.endpoint), {
    subscription,
    accounts: await sealValue(accounts),
    cursors: current?.cursors ?? {},
    timeZone
  } satisfies StoredPush)
}

export async function removePush(endpoint: string) {
  await useStorage('letterbox').removeItem(subKey(endpoint))
}

/** Signing out of a mailbox stops push for it on every browser */
export async function forgetPushFor(email: string) {
  const storage = useStorage('letterbox')
  for (const key of await storage.getKeys(PREFIX)) {
    const stored = await storage.getItem<StoredPush>(key)
    if (!stored) continue
    const accounts = await unsealValue<AccountSettings[]>(stored.accounts).catch(() => [])
    const left = accounts.filter(account => account.email.toLowerCase() !== email.toLowerCase())
    if (!left.length) await storage.removeItem(key)
    else if (left.length !== accounts.length) await storage.setItem(key, { ...stored, accounts: await sealValue(left) })
  }
}

function localNow(timeZone: string) {
  try {
    return new Date(new Date().toLocaleString('en-US', { timeZone }))
  } catch {
    return new Date()
  }
}

function quiet(settings: NotificationSettings, timeZone: string) {
  if (!settings.quietFrom || !settings.quietTo || settings.quietFrom === settings.quietTo) return false
  const now = localNow(timeZone)
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
  const current = now.getHours() * 60 + now.getMinutes()
  const from = minutes(settings.quietFrom)
  const to = minutes(settings.quietTo)
  return from < to ? current >= from && current < to : current >= from || current < to
}

async function checkOne(key: string, stored: StoredPush) {
  const accounts = await unsealValue<AccountSettings[]>(stored.accounts)
  const settings = (await readStore<Partial<UserSettings>>(accounts[0]!, 'settings', {})).notifications
  if (!settings?.push) return removePush(stored.subscription.endpoint)

  const { publicKey, privateKey } = await vapidKeys()
  const cursors = { ...stored.cursors }
  for (const account of accounts) {
    const email = account.email.toLowerCase()
    const folders = notifyFolders(settings, email)
    if (!folders.length) continue
    const news = await checkNewMail(account, folders, cursors[email] ?? {}).catch(() => undefined)
    if (!news) continue
    cursors[email] = news.cursors
    if (!news.messages.length || quiet(settings, stored.timeZone)) continue

    const first = news.messages[news.messages.length - 1]!
    const more = news.messages.length > 1 ? ` and ${news.messages.length - 1} more` : ''
    const payload = {
      title: settings.preview ? `${first.from.name || first.from.address}${more}` : 'New mail',
      body: settings.preview ? first.subject || '(No subject)' : `${news.messages.length} new in ${email}`,
      tag: `citrusmail-${email}`,
      url: `/mail/${encodeURIComponent(first.folder)}?m=${encodeURIComponent(first.id)}`
    }
    try {
      await webpush.sendNotification(stored.subscription, JSON.stringify(payload), {
        vapidDetails: { subject: `mailto:${accounts[0]!.email}`, publicKey, privateKey },
        TTL: 3600
      })
    } catch (error) {
      // The browser dropped the subscription
      if ([404, 410].includes((error as { statusCode?: number }).statusCode ?? 0)) return removePush(stored.subscription.endpoint)
    }
  }
  await useStorage('letterbox').setItem(key, { ...stored, cursors })
}

let running = false

/** Checks every push subscription for new mail, one at a time */
export async function runPush() {
  if (running) return
  running = true
  try {
    const storage = useStorage('letterbox')
    for (const key of await storage.getKeys(PREFIX)) {
      const stored = await storage.getItem<StoredPush>(key)
      if (stored) await checkOne(key, stored).catch(() => {})
    }
  } finally {
    running = false
  }
}
