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

/** A message's searchable text, folded once and kept, since search tests it on every keystroke */
const haystacks = new WeakMap<object, string>()
export function searchHaystack(message: Pick<MessageSummary, 'subject' | 'from' | 'to' | 'preview'>): string {
  let hay = haystacks.get(message)
  if (hay === undefined) {
    hay = fold([
      message.subject,
      message.from?.name, message.from?.address,
      ...(message.to ?? []).flatMap(address => [address.name, address.address]),
      message.preview
    ].filter(Boolean).join('\n'))
    haystacks.set(message, hay)
  }
  return hay
}

/** A test for what's typed, made once and run over every message */
export function searchMatcher(terms: string[]): (message: Pick<MessageSummary, 'subject' | 'from' | 'to' | 'preview'>) => boolean {
  const patterns = terms.map(term => new RegExp(`(?:^|[^\\p{L}\\p{N}])${escape(fold(term))}`, 'u'))
  return message => patterns.length > 0 && patterns.every(pattern => pattern.test(searchHaystack(message)))
}

/** Every term begins a word somewhere in the message (accents ignored) */
export function messageMatches(message: Pick<MessageSummary, 'subject' | 'from' | 'to' | 'preview'>, terms: string[]): boolean {
  return searchMatcher(terms)(message)
}

/**
 * The files the server found by name that still hold every word typed. The
 * server matches anywhere in a name ("voice" finds "Invoice.pdf"), so this does too
 */
export function attachmentNameMatches(message: Pick<MessageSummary, 'matchedAttachments'>, terms: string[]): MatchedAttachment[] {
  if (!message.matchedAttachments?.length || !terms.length) return []
  const folded = terms.map(fold)
  return message.matchedAttachments.filter((file) => {
    // Found inside the file: its name needn't hold the words
    if (file.passage) return true
    const name = fold(file.filename)
    return folded.every(term => name.includes(term))
  })
}

/**
 * The text cut into plain and matching pieces, for marking matches as you type (accents ignored, as when matching).
 * `anywhere` marks a term inside a word too, as file names are matched
 */
export function highlightParts(text: string, terms: string[], anywhere = false): { text: string, hit: boolean }[] {
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
  const pattern = new RegExp(`${anywhere ? '' : '(?<![\\p{L}\\p{N}])'}(${[...terms].map(fold).sort((a, b) => b.length - a.length).map(escape).join('|')})`, 'gu')
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
