// Turning a mail server's stored preview of a message into the one line a
// list shows. JMAP servers hand out plain but raw text: link addresses in
// angle brackets, a few HTML entities, line breaks, and for an HTML-only
// message with a <style> block, the stylesheet. Text handling only: nothing
// here asks the mail server for more. Pure: no imports.

export const PREVIEW_MAX_CHARS = 200

/** One line of preview: link addresses dropped, entities decoded, whitespace folded, capped */
export function previewToSnippet(text: string, length = PREVIEW_MAX_CHARS): string {
  return text
    // "Sign in<https://long.tracking/link>": the address is noise in a preview.
    // The last one may be cut off by the server before its ">"
    .replace(/<https?:\/\/[^>\s]*>?/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, '\'')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, length)
}

/** The preview is a stylesheet: the server previewed an HTML-only message from its <style> block */
export function looksLikeStylesheet(text: string): boolean {
  const start = text.trimStart()
  if (/^(@import|@media|@font-face|@charset|@namespace|<!--|\/\*|<style)/i.test(start)) return true
  // "body { margin: 0", ".ExternalClass{width:100%}", "a:hover { color: red; }"
  return /^[^{}]{0,120}\{[^{}]{0,200}:[^{}]{0,200}[;}]/.test(start)
}

/** The line a list row shows for a server's preview; none when the server's text is a stylesheet */
export function serverPreview(raw: string | null | undefined): string {
  if (!raw || looksLikeStylesheet(raw)) return ''
  return previewToSnippet(raw)
}
