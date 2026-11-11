export type CalendarView = 'day' | 'week' | 'month' | 'year'

export interface DateRange {
  start: Date
  end: Date
}

export interface Calendar {
  id: string
  name: string
  color: 'info' | 'success' | 'warning' | 'error' | 'primary' | 'secondary'
}

export interface CalendarEvent {
  id: string
  calendarId: string
  title: string
  description?: string
  start: string
  end: string
  allDay?: boolean
  /** Part of a repeating series: edits apply to every occurrence */
  recurring?: boolean
}

/* ------------------------------------------------------------------ */
/* Account                                                             */
/* ------------------------------------------------------------------ */

export type Security = 'tls' | 'starttls' | 'none'

export interface ServerSettings {
  host: string
  port: number
  security: Security
}

export type MailProtocol = 'imap' | 'pop3' | 'jmap'

export interface IncomingSettings extends ServerSettings {
  protocol: MailProtocol
  /** JMAP: the session URL, when it isn't https://host/.well-known/jmap */
  url?: string
  /** JMAP: how the password goes, found at sign-in: as a password (Basic) or an API token (Bearer) */
  auth?: 'basic' | 'bearer'
}

/** Everything needed to reach one account. Lives only in the sealed session cookie. */
export interface AccountSettings {
  email: string
  name?: string
  /** Login name when it differs from the email address */
  username?: string
  /** Empty for a mailbox signed in with OAuth (see `oauth`) */
  password: string
  /** Set when the provider only takes OAuth (Microsoft 365, Outlook.com): the tokens, kept fresh by requireAccount() */
  oauth?: OAuthTokens
  incoming: IncomingSettings
  /** With JMAP, only used when the JMAP server can't send mail itself */
  outgoing: ServerSettings
  /** CalDAV / CardDAV root, e.g. https://dav.example.com. Empty = feature off */
  caldav?: string
  carddav?: string
}

export interface OAuthTokens {
  provider: 'microsoft'
  accessToken: string
  refreshToken: string
  /** When accessToken stops working, ms since epoch */
  expiresAt: number
  /** Stands in for the password where one is needed as a key (vault.ts) */
  secret: string
}

/** What discovery found for an address, before a password is involved */
export interface DiscoveryResult {
  /** The provider takes no password: sign in goes through this OAuth provider */
  oauth?: 'microsoft'
  /** Whether this server is set up for that (a client id in the environment) */
  oauthReady?: boolean
  provider?: string
  /** Iconify name for the provider logo, e.g. i-simple-icons-gmail */
  icon?: string
  /** Shown when the provider needs an app password instead of the normal one */
  appPasswordUrl?: string
  incoming?: AccountSettings['incoming']
  outgoing?: ServerSettings
  /** A JMAP session URL the domain or its mail host answers on: sign-in tries it before IMAP */
  jmap?: string
  caldav?: string
  carddav?: string
  /** Where the settings came from, e.g. 'preset', 'ispdb', 'srv', 'guess' */
  source: string
  /** Login name when the provider's config says it differs from the email address */
  username?: string
  /** One-line hint for the sign-in form, e.g. that Proton needs Proton Mail Bridge running */
  note?: string
}

/** The session user exposed to the client, without the password */
export interface SessionAccount {
  email: string
  name?: string
  protocol: MailProtocol
  hasCalendar: boolean
  hasContacts: boolean
  /** Every mailbox signed in on this browser, the open one first */
  mailboxes?: MailboxSummary[]
}

/** One of the mailboxes you can switch to */
export interface MailboxSummary {
  email: string
  name?: string
}

/* ------------------------------------------------------------------ */
/* Mail                                                                */
/* ------------------------------------------------------------------ */

export type FolderRole = 'inbox' | 'drafts' | 'sent' | 'junk' | 'trash' | 'archive' | 'flagged'

export interface Folder {
  /** Full IMAP path (JMAP: the mailbox id, INBOX for the Inbox), used as the id in URLs (encodeURIComponent) */
  path: string
  name: string
  role?: FolderRole
  unread: number
  /** Nesting depth for display */
  depth: number
}

export interface Address {
  name?: string
  address: string
}

export interface MessageSummary {
  /** IMAP UID, POP3 UIDL, or JMAP email id */
  id: string
  folder: string
  subject: string
  from: Address
  to: Address[]
  date: string
  preview: string
  unread: boolean
  flagged: boolean
  hasAttachments: boolean
  /** The Message-ID header, to match read receipts to what you sent */
  messageId?: string
  /** For a message you sent with tracking on: what's come back so far */
  receipt?: ReceiptStatus
}

/** What's known about a tracked message, as ISO times */
export interface ReceiptStatus {
  /** The recipient's mail server accepted it */
  delivered?: string
  opened?: string
  /** The only opens seen could have been a machine (Apple Mail preloading, a security scanner) */
  maybe?: boolean
  /** It bounced */
  failed?: string
}

/** Settings → Tracking */
export interface ReceiptSettings {
  /** New messages start with tracking on */
  default: boolean
  /** Add the tracking image (needs Faivelo as the provider, or `origin`) */
  images: boolean
  /** Where the image is served from: Faivelo (for Faivelo mailboxes), or this server at `origin` */
  provider?: 'faivelo' | 'self'
  /** The address this CitrusMail is reachable at from the internet, checked before it's saved */
  origin?: string
}

export interface MessagePage {
  messages: MessageSummary[]
  total: number
  /** Pass back as `before` to load the next page; absent on the last page */
  cursor?: string
}

export interface Attachment {
  /** Index into the parsed message's attachments */
  index: number
  filename: string
  contentType: string
  size: number
}

export interface MessageDetail extends MessageSummary {
  cc: Address[]
  replyTo: Address[]
  references?: string[]
  /** Sanitized HTML, ready for a sandboxed iframe */
  html?: string
  text?: string
  attachments: Attachment[]
  /** HTML had remote images that were blocked */
  remoteContent: boolean
  /** Remote images were loaded because of your settings or the sender being on your allow list */
  remoteShown?: boolean
  /** How this mailing list can be left, when it says (List-Unsubscribe) */
  unsubscribe?: UnsubscribeMethod
}

/**
 * 'one-click': CitrusMail unsubscribes for you (RFC 8058). 'email': it sends the
 * list the unsubscribe email. 'link': only the sender's own web page can do it
 */
export type UnsubscribeMethod = 'one-click' | 'email' | 'link'

/** A sender whose mail carries an unsubscribe link */
export interface Subscription {
  address: string
  name?: string
  /** Messages from them among the ones checked */
  count: number
  lastDate: string
  /** Their newest message, which the unsubscribe request is made from */
  folder: string
  id: string
  method: UnsubscribeMethod
  /** When you unsubscribed from here, if you did */
  unsubscribedAt?: string
}

export interface UnsubscribeResult {
  /** Done here; otherwise `url` is the sender's page to finish on */
  done: boolean
  method: UnsubscribeMethod
  url?: string
}

export interface OutgoingAttachment {
  filename: string
  contentType: string
  /** base64 */
  content: string
}

export interface OutgoingMessage {
  to: Address[]
  cc?: Address[]
  bcc?: Address[]
  subject: string
  html: string
  text?: string
  inReplyTo?: string
  references?: string[]
  attachments?: OutgoingAttachment[]
  /** Track delivery and opens: a read receipt request, a delivery report and, if set up, the tracking image */
  readReceipt?: boolean
}

/** Where a saved draft lives on the server, so saving again replaces it */
export interface DraftRef {
  folder: string
  id: string
}

/** A message waiting in the outbox to be sent later */
export interface ScheduledMessage {
  id: string
  /** ISO time it goes out */
  sendAt: string
  to: Address[]
  subject: string
  preview: string
  status: 'waiting' | 'sending' | 'failed'
  error?: string
}

/* ------------------------------------------------------------------ */
/* Contacts                                                            */
/* ------------------------------------------------------------------ */

export interface ContactBook {
  id: string
  name: string
}

export interface Contact {
  /** base64url of the vCard URL; empty for a new contact */
  id: string
  bookId: string
  name: string
  emails: string[]
  phones: string[]
  company?: string
  title?: string
  note?: string
  birthday?: string
}

/* ------------------------------------------------------------------ */
/* Search filters, settings and rules                                  */
/* ------------------------------------------------------------------ */

export type DateWithin = 'week' | 'month' | 'year'

export interface MailFilters {
  from?: string
  within?: DateWithin
  /** One day, YYYY-MM-DD, as the reader sees it */
  on?: string
  attachments?: boolean
}

/** A picture behind the app, and how it's treated */
export interface BackgroundSettings {
  /** Bumped on each upload, so the browser fetches the new picture */
  version: number
  /** 0 to 24 px */
  blur: number
  /** 40 to 140 percent */
  brightness: number
  /** 0 to 200 percent */
  saturation: number
  filter: 'none' | 'mono' | 'sepia' | 'warm' | 'cool'
}

export type RemoteImages = 'ask' | 'allowed' | 'always'

export type NotificationSound = 'none' | 'chime' | 'pop' | 'bell' | 'drop' | 'marimba'

export interface NotificationSettings {
  enabled: boolean
  /** System banners (the OS notification center) */
  banners: boolean
  /** A card inside the app when it's in front */
  inApp: boolean
  sound: NotificationSound
  /** 0 to 100 */
  volume: number
  /** Show who wrote and the first line, or only "New message" */
  preview: boolean
  /** Push to this browser even when the app is closed */
  push: boolean
  /** Mailbox email → folder paths to notify for; a mailbox missing here gets its Inbox */
  folders: Record<string, string[]>
  /** Mailboxes that never notify */
  muted: string[]
  /** HH:mm to HH:mm, local time; empty for none */
  quietFrom: string
  quietTo: string
}

export type MailView = 'split' | 'list'

export type AiProvider = 'anthropic' | 'openai' | 'gemini' | 'grok' | 'perplexity'

export interface UserSettings {
  /** Sanitized HTML, added under every new message */
  signature: string
  /** 'rich' was written in the editor, 'html' was pasted as source */
  signatureMode: 'rich' | 'html'
  signatureOnReplies: boolean
  /** A small square JPEG as a data URL, shown on your messages in CitrusMail */
  avatar?: string
  /** Settings → Appearance: accent, font, text size and corners */
  appearance?: { primary?: string, font?: string, fontSize?: string, radius?: string, background?: BackgroundSettings }
  /** When remote images in a message load on their own */
  remoteImages?: RemoteImages
  notifications?: NotificationSettings
  /** Reading pane beside the list, or the list alone */
  view?: MailView
  /** The message list's width in the split view, in px */
  listWidth?: number
  /** ISO 639-1 code messages are translated into; English when unset */
  language?: string
  /** The AI provider whose key is used, when more than one is saved */
  aiProvider?: AiProvider
  receipts?: ReceiptSettings
  /** When these settings last changed anywhere, for syncing between devices */
  updatedAt?: number
}

/** Senders whose mail always lands in the Inbox, and senders whose never does */
export interface SenderLists {
  /** Addresses, or domains written as @example.com */
  allowed: string[]
  blocked: string[]
  /** Where blocked mail goes */
  blockAction: 'junk' | 'trash'
}

/** Which AI keys are saved, never the keys themselves */
export interface AiStatus {
  providers: { provider: AiProvider, label: string, saved: boolean, hint?: string, model: string }[]
  active?: AiProvider
}

export interface AiSearchResult {
  /** A sentence about what was found, or the answer to a question */
  answer: string
  messages: MessageSummary[]
  /** How the question was read, e.g. "From Ada, last month, about invoices" */
  interpreted: string
}

export type RuleField = 'from' | 'to' | 'subject'

export interface RuleCondition {
  field: RuleField
  value: string
}

export interface MailRule {
  id: string
  enabled: boolean
  match: 'all' | 'any'
  conditions: RuleCondition[]
  /** Folder path the matching mail moves to */
  folder: string
  markRead: boolean
  /** Only Inbox mail from this UID on, so a new rule leaves older mail alone */
  after?: { validity: string, uid: number }
}

/** A rule as the client saves it: the folder can be one that doesn't exist yet */
export interface RuleInput extends Omit<MailRule, 'after'> {
  createFolder?: boolean
  applyToExisting?: boolean
}
