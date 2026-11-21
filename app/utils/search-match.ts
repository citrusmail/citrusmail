// Search as the iPhone app does it: every word typed has to begin a word
// somewhere in the message (who it's from or to, the subject, the preview),
// so "inv ma" finds "Invoice for March". Runs on each keystroke over mail
// already on this device, and marks the matching starts in the results.

/** The words typed, lower-cased, without quotes or stray punctuation */
export function searchTerms(text: string): string[] {
  return [...new Set(text.toLowerCase().split(/[\s"'“”‘’,;]+/).map(word => word.trim()).filter(Boolean))].slice(0, 8)
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Every term begins a word somewhere in the message (accents ignored) */
export function messageMatches(message: Pick<MessageSummary, 'subject' | 'from' | 'to' | 'preview'>, terms: string[]): boolean {
  if (!terms.length) return false
  const haystack = fold([
    message.subject,
    message.from?.name, message.from?.address,
    ...(message.to ?? []).flatMap(address => [address.name, address.address]),
    message.preview
  ].filter(Boolean).join('\n'))
  return terms.every(term => new RegExp(`(?:^|[^\\p{L}\\p{N}])${escape(fold(term))}`, 'u').test(haystack))
}

/** The text cut into plain and matching pieces, for marking matches as you type (accents ignored, as when matching) */
export function highlightParts(text: string, terms: string[]): { text: string, hit: boolean }[] {
  if (!text || !terms.length) return [{ text, hit: false }]
  // Matched on the folded text; `at[i]` is where folded character i came from
  let folded = ''
  const at: number[] = []
  for (let i = 0; i < text.length;) {
    const char = String.fromCodePoint(text.codePointAt(i)!)
    for (const piece of fold(char)) {
      folded += piece
      at.push(i)
    }
    i += char.length
  }
  at.push(text.length)
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${[...terms].map(fold).sort((a, b) => b.length - a.length).map(escape).join('|')})`, 'gu')
  const parts: { text: string, hit: boolean }[] = []
  let done = 0
  for (const match of folded.matchAll(pattern)) {
    const start = at[match.index]!
    const end = at[match.index + match[0].length]!
    if (end <= done) continue
    if (start > done) parts.push({ text: text.slice(done, start), hit: false })
    parts.push({ text: text.slice(Math.max(start, done), end), hit: true })
    done = end
  }
  if (done < text.length) parts.push({ text: text.slice(done), hit: false })
  return parts
}
