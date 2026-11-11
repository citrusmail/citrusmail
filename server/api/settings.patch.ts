import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import type { RequestEvent } from 'nuxt/server'
import { z } from 'zod'

const time = z.union([z.literal(''), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)])

const schema = z.object({
  signature: z.string().max(100_000).optional(),
  signatureMode: z.enum(['rich', 'html']).optional(),
  signatureOnReplies: z.boolean().optional(),
  // Resized in the browser to a small square JPEG; '' removes it
  avatar: z.union([
    z.literal(''),
    z.string().max(200_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'That picture couldn\'t be read')
  ]).optional(),
  // These end up in a stylesheet, so each is held to a strict shape
  appearance: z.object({
    primary: z.string().regex(/^(#[0-9a-f]{3}|#[0-9a-f]{6}|[a-z]{3,20})$/i).optional(),
    font: z.string().max(200).regex(/^[\w\s'",.-]+$/).optional(),
    fontSize: z.string().regex(/^\d{2}px$/).optional(),
    radius: z.string().regex(/^\d{1,2}(\.\d{1,3})?(rem|px)$/).optional(),
    background: z.object({
      version: z.number().int().min(0),
      blur: z.number().min(0).max(24),
      brightness: z.number().min(40).max(140),
      saturation: z.number().min(0).max(200),
      filter: z.enum(['none', 'mono', 'sepia', 'warm', 'cool'])
    }).optional()
  }).optional(),
  remoteImages: z.enum(['ask', 'allowed', 'always']).optional(),
  notifications: z.object({
    enabled: z.boolean(),
    banners: z.boolean(),
    inApp: z.boolean(),
    sound: z.enum(['none', 'chime', 'pop', 'bell', 'drop', 'marimba']),
    volume: z.number().min(0).max(100),
    preview: z.boolean(),
    push: z.boolean(),
    folders: z.record(z.string().max(254), z.array(z.string().max(1000)).max(50)),
    muted: z.array(z.string().max(254)).max(20),
    quietFrom: time,
    quietTo: time
  }).optional(),
  view: z.enum(['split', 'list']).optional(),
  listWidth: z.number().int().min(280).max(640).optional(),
  // The language messages are translated into
  language: z.string().regex(/^[a-z]{2,3}$/).optional(),
  aiProvider: z.enum(['anthropic', 'openai', 'gemini', 'grok', 'perplexity']).optional(),
  receipts: z.object({
    default: z.boolean(),
    images: z.boolean(),
    provider: z.enum(['faivelo', 'self']).optional(),
    origin: z.union([z.literal(''), z.url().max(200).startsWith('https://')]).optional()
  }).optional()
})

/**
 * The full name of every folder chosen for notifications, for each signed-in
 * mailbox, so a device using the other protocol (IMAP or JMAP) finds them.
 * Names already known are kept for mailboxes that can't be listed right now
 */
async function notificationFolderNames(event: RequestEvent, chosen: Record<string, string[]>, known: Record<string, Record<string, string>> = {}) {
  const names: Record<string, Record<string, string>> = {}
  for (const account of await sessionAccounts(event)) {
    const email = account.email.toLowerCase()
    const paths = chosen[email]?.filter(path => path !== 'INBOX') ?? []
    if (!paths.length || account.incoming.protocol === 'pop3') continue
    const folders = await mailFor(account).listFolders().catch(() => undefined)
    names[email] = Object.fromEntries(paths.flatMap((path) => {
      const folder = folders?.find(entry => entry.path === path)
      const name = folder ? folderFullName(folder) : known[email]?.[path]
      return name ? [[path, name]] : []
    }))
  }
  return names
}

export default defineEventHandler(async (event): Promise<UserSettings> => {
  const body = await readValidatedBody(event, schema)
  const account = await requireAccount(event)
  const current = { ...DEFAULT_SETTINGS, ...await readStore<Partial<UserSettings>>(account, 'settings', {}) }
  const notifications = body.notifications && { ...body.notifications, folderNames: await notificationFolderNames(event, body.notifications.folders, current.notifications?.folderNames) }
  const next: UserSettings = {
    ...current,
    ...body,
    ...(notifications ? { notifications } : {}),
    signature: body.signature !== undefined ? sanitizeSignature(body.signature) : current.signature,
    avatar: body.avatar !== undefined ? body.avatar || undefined : current.avatar,
    updatedAt: Date.now()
  }
  await writeStore(account, 'settings', next)
  return next
})
