import type { AddressObject, ParsedMail } from 'mailparser'

type Base = Pick<MessageSummary, 'id' | 'folder' | 'unread' | 'flagged'>

/** Whether remote images load: yes, no, or decided by who sent the message */
export type RemotePolicy = boolean | ((from: Address) => boolean)

export function flattenAddresses(value?: AddressObject | AddressObject[]): Address[] {
  const objects = Array.isArray(value) ? value : value ? [value] : []
  return objects.flatMap(o => o.value)
    .flatMap(a => a.group ?? [a])
    .filter(a => a.address)
    .map(a => ({ name: a.name || undefined, address: a.address! }))
}

export function makePreview(text: string, length = 140): string {
  return text
    .replace(/^>.*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, length)
}

function cidOf(attachment: ParsedMail['attachments'][number]) {
  return (attachment.contentId ?? attachment.cid ?? '').replace(/^<|>$/g, '')
}

/**
 * A parsed message as the client sees it, with cid: images inlined and remote
 * content blocked. Parse with `skipImageLinks: true` so the cid: links are still there.
 */
/** A cid as written when it isn't valid percent-encoding ("cid:50%off" in plain text), which would throw */
function decoded(cid: string) {
  try {
    return decodeURIComponent(cid)
  } catch {
    return cid
  }
}

export function toMessageDetail(parsed: ParsedMail, base: Base, policy: RemotePolicy): MessageDetail {
  const from = flattenAddresses(parsed.from)[0] ?? { address: '' }
  const allowRemote = typeof policy === 'function' ? policy(from) : policy
  const embedded = new Set<number>()
  let html: string | undefined
  let remoteContent = false

  if (parsed.html) {
    const byCid = new Map(parsed.attachments.map((a, index) => [cidOf(a), index] as const).filter(([cid]) => cid))
    const inlined = parsed.html.replace(/cid:([^"'\s)>]+)/gi, (match, cid: string) => {
      const index = byCid.get(decoded(cid))
      if (index === undefined) return match
      embedded.add(index)
      const a = parsed.attachments[index]!
      return `data:${a.contentType};base64,${a.content.toString('base64')}`
    })
    ;({ html, remoteContent } = sanitizeEmailHtml(inlined, allowRemote))
  }

  const header = (key: string) => parsed.headerLines.find(line => line.key === key)?.line.replace(/^[^:]+:\s*/, '')
  const unsubscribe = parseUnsubscribe(header('list-unsubscribe'), header('list-unsubscribe-post'))

  const text = parsed.text?.trim() || (parsed.html ? htmlToText(parsed.html) : '')
  const references = typeof parsed.references === 'string' ? [parsed.references] : parsed.references

  return {
    ...base,
    subject: parsed.subject ?? '',
    from,
    to: flattenAddresses(parsed.to),
    cc: flattenAddresses(parsed.cc),
    replyTo: flattenAddresses(parsed.replyTo),
    date: (parsed.date ?? new Date()).toISOString(),
    preview: makePreview(text),
    hasAttachments: parsed.attachments.some((_, i) => !embedded.has(i)),
    messageId: parsed.messageId,
    references,
    html,
    text,
    remoteContent,
    remoteShown: allowRemote && Boolean(html),
    unsubscribe: unsubscribe ? unsubscribeMethod(unsubscribe) : undefined,
    attachments: parsed.attachments
      .map((a, index) => ({ index, filename: a.filename || `attachment-${index + 1}`, contentType: a.contentType, size: a.size }))
      .filter(a => !embedded.has(a.index))
  }
}
