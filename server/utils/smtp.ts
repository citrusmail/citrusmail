import { randomUUID } from 'node:crypto'
import nodemailer from 'nodemailer'
import MailComposer from 'nodemailer/lib/mail-composer'

/** Tags an error so withAccount() explains it in terms of the SMTP server */
export function outgoingError(error: unknown) {
  if (error && typeof error === 'object') Object.assign(error, { side: 'outgoing' })
  return error
}

async function transport(account: AccountSettings) {
  const { outgoing } = account
  // Connect to the checked address; the certificate is still verified against the name
  const target = await connectTarget(outgoing.host)
  return nodemailer.createTransport({
    host: target.address,
    servername: target.servername,
    port: outgoing.port,
    secure: outgoing.security === 'tls',
    requireTLS: outgoing.security === 'starttls',
    ignoreTLS: outgoing.security === 'none',
    auth: account.oauth
      ? { type: 'OAuth2' as const, user: account.username || account.email, accessToken: account.oauth.accessToken }
      : { user: account.username || account.email, pass: account.password },
    tls: isLoopback(outgoing.host) ? { rejectUnauthorized: false } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 8000,
    socketTimeout: 60_000
  })
}

export async function verifySmtp(account: AccountSettings) {
  const transporter = await transport(account)
  try {
    await transporter.verify()
  } finally {
    transporter.close()
  }
}

/**
 * Pictures dropped or pasted into the editor arrive as data: URLs. Most mail
 * programs won't show those, so each becomes an inline attachment the HTML
 * points to by Content-ID
 */
function embedDataImages(html: string) {
  const inline: { filename: string, contentType: string, content: Buffer, cid: string }[] = []
  const out = html.replace(/(<img\b[^>]*?\ssrc=)(["'])data:(image\/(?:png|jpe?g|gif|webp));base64,([A-Za-z0-9+/=\s]+)\2/gi, (_match, start: string, quote: string, type: string, data: string) => {
    const cid = `img${inline.length + 1}.${randomUUID()}@citrusmail`
    const ext = type.split('/')[1]!.replace('jpeg', 'jpg')
    inline.push({ filename: `image-${inline.length + 1}.${ext}`, contentType: type, content: Buffer.from(data.replace(/\s/g, ''), 'base64'), cid })
    return `${start}${quote}cid:${cid}${quote}`
  })
  return { html: out, inline }
}

/** The message as it goes out, also used for drafts (which keep their Bcc) */
export function composeMessage(account: AccountSettings, message: OutgoingMessage, options: { keepBcc?: boolean, messageId?: string, date?: Date } = {}) {
  const { html, inline } = embedDataImages(message.html)
  const node = new MailComposer({
    messageId: options.messageId,
    date: options.date,
    from: { name: account.name ?? '', address: account.email },
    to: message.to,
    cc: message.cc,
    bcc: message.bcc,
    subject: message.subject,
    html,
    text: message.text || htmlToText(html),
    inReplyTo: message.inReplyTo,
    references: message.references,
    // The standard receipt request (RFC 8098): the recipient's app asks them
    // and replies on its own. Nothing is embedded, so filters don't mind it
    headers: message.readReceipt ? { 'Disposition-Notification-To': account.email } : undefined,
    attachments: [
      ...(message.attachments ?? []).map(a => ({
        filename: a.filename,
        contentType: a.contentType,
        content: Buffer.from(a.content, 'base64')
      })),
      ...inline
    ]
  }).compile()
  if (options.keepBcc) node.keepBcc = true
  return node
}

/** Hands a built message to something other than SMTP (a JMAP server); `sentCopy` is the one for Sent */
export type Deliver = (raw: Buffer, envelope: { from: string, to: string[] }, sentCopy: Buffer, dsn?: { id: string }) => Promise<void>

/** Sends over the account's SMTP server, or `deliver`, and returns the raw message, for the Sent folder */
export async function sendMail(account: AccountSettings, message: OutgoingMessage, deliver?: Deliver): Promise<{ messageId: string, raw: Buffer }> {
  const domain = account.email.split('@')[1] || 'citrusmail.local'
  const messageId = `<${randomUUID()}@${domain}>`
  const date = new Date()
  // Tracking only happens with the image set up (Settings → Tracking); a
  // message asking for it otherwise goes out plain
  const pixel = message.readReceipt
    ? await pixelFor(account, messageId, message).catch((error) => {
        console.warn('[CitrusMail] Tracking image:', (error as Error).message)
        return undefined
      })
    : undefined
  const plain = { ...message, readReceipt: !!pixel || undefined }
  // Your Sent copy never carries the image, so reading it isn't an open
  const sentCopy = composeMessage(account, plain, { messageId, date })
  const node = pixel ? composeMessage(account, { ...plain, html: plain.html + pixel }, { messageId, date }) : sentCopy

  // Bcc is left out of the built message but kept in the envelope
  const envelope = node.getEnvelope()
  const raw = await node.build()
  if (deliver) {
    const copy = pixel ? await sentCopy.build() : raw
    // Tracked mail asks for delivery reports there too, by the same envelope id
    await deliver(raw, { from: account.email, to: envelope.to }, copy, pixel ? { id: messageId } : undefined)
    if (pixel) await markTracked(account, messageId).catch(() => {})
    return { messageId, raw: copy }
  }
  const transporter = await transport(account)
  try {
    await transporter.sendMail({
      envelope: { from: account.email, to: envelope.to },
      raw,
      // A delivery report when it reaches each recipient's server. Only asked
      // of servers that offer it (RFC 3461); others send as usual
      dsn: pixel ? { id: messageId, return: 'headers', notify: ['success', 'failure'] } : undefined
    })
  } catch (error) {
    throw outgoingError(error)
  } finally {
    transporter.close()
  }
  if (pixel) await markTracked(account, messageId).catch(() => {})
  return { messageId, raw: pixel ? await sentCopy.build() : raw }
}
