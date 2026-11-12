import DOMPurify from 'isomorphic-dompurify'

// Detection only: the message frame's Content-Security-Policy is what actually
// stops remote loads, so a URL these miss still can't be fetched
const REMOTE = /^(?:[a-z][a-z0-9+.-]*:)?[\\/]{2}|^https?:/i

/** As a URL parser reads it: tabs and newlines anywhere, and leading controls and spaces, are ignored */
function normalizeUrl(value: string) {
  const compact = value.replace(/[\t\n\r]/g, '')
  let start = 0
  while (start < compact.length && compact.charCodeAt(start) <= 32) start++
  return compact.slice(start)
}

const CSS_REMOTE_URL = /url\(\s*(?:['"]\s*)?(?:https?:)?\/\/[^)]*\)/gi
const CSS_IMPORT = /@import[^;]*;?/gi
const CSS_IMAGE_SET = /(?:-webkit-)?image-set\([^)]*\)/gi

// sanitize() is synchronous, so the hooks read the options of the call in progress
let current: { allowRemote: boolean, blocked: boolean } = { allowRemote: false, blocked: false }

function stripRemoteCss(css: string): string {
  const cleaned = css.replace(CSS_IMPORT, '').replace(CSS_IMAGE_SET, 'none').replace(CSS_REMOTE_URL, 'none')
  if (cleaned !== css) current.blocked = true
  return cleaned
}

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
  if (current.allowRemote) return

  for (const attr of ['src', 'srcset', 'background', 'poster']) {
    const value = node.getAttribute(attr)
    if (value && (REMOTE.test(normalizeUrl(value)) || (attr === 'srcset' && /https?:\/\//i.test(value)))) {
      node.removeAttribute(attr)
      current.blocked = true
    }
  }
  const style = node.getAttribute('style')
  if (style) node.setAttribute('style', stripRemoteCss(style))
})

DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName === 'style' && !current.allowRemote && node.textContent) {
    node.textContent = stripRemoteCss(node.textContent)
  }
})

/**
 * Makes email HTML safe for a sandboxed iframe: no scripts, forms or event
 * handlers, links open in a new tab, and remote content is dropped unless
 * `allowRemote` (tracking pixels included).
 */
export function sanitizeEmailHtml(html: string, allowRemote: boolean): { html: string, remoteContent: boolean } {
  current = { allowRemote, blocked: false }
  const clean = DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: true,
    FORBID_TAGS: ['script', 'form', 'input', 'button', 'textarea', 'select', 'option', 'iframe', 'frame', 'frameset', 'object', 'embed', 'base', 'meta', 'link', 'svg', 'math'],
    FORBID_ATTR: ['action', 'formaction'],
    ADD_TAGS: ['style'],
    ADD_ATTR: ['target']
  })
  return { html: clean, remoteContent: current.blocked }
}

/** Drops <style>, <script> and <head> blocks in one pass (an unclosed one runs to the end) */
function stripBlocks(html: string): string {
  const lower = html.toLowerCase()
  const open = /<(style|script|head)\b/g
  let out = ''
  let from = 0
  for (let match = open.exec(lower); match; match = open.exec(lower)) {
    if (match.index < from) continue
    out += html.slice(from, match.index)
    const close = lower.indexOf(`</${match[1]}`, match.index)
    if (close < 0) return out
    const end = lower.indexOf('>', close)
    from = end < 0 ? html.length : end + 1
    open.lastIndex = from
  }
  return out + html.slice(from)
}

/**
 * Rough HTML → text, for previews and the plain-text part of outgoing mail.
 * Every pattern here stops at the next `<`, so hostile markup stays linear
 */
export function htmlToText(html: string): string {
  return stripBlocks(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<li[^<>]*>/gi, '- ')
    .replace(/<[^<>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, '\'')
    // Past the last code point fromCodePoint throws, and one message would take the whole list down
    .replace(/&#(\d+);/g, (_, n) => Number(n) <= 0x10FFFF ? String.fromCodePoint(Number(n)) : '')
    // Line by line: a regex over the whole text is quadratic on long runs of spaces
    .split('\n').map(line => line.trimEnd()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** A signature is the user's own HTML: remote logos stay, scripts and forms go */
export function sanitizeSignature(html: string): string {
  current = { allowRemote: true, blocked: false }
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ['script', 'form', 'input', 'button', 'textarea', 'select', 'option', 'iframe', 'frame', 'frameset', 'object', 'embed', 'base', 'meta', 'link', 'math', 'style'],
    FORBID_ATTR: ['action', 'formaction'],
    ADD_ATTR: ['target']
  }).trim()
}
