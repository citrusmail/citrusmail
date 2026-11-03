/**
 * AI Translate works on a message's text in place: every run of text becomes
 * a segment, the model translates each one, and each is swapped where it
 * stood, so links, bold and the sender's layout all stay
 */
export interface Segment {
  node: Text
  /** The text sent for translation, without its surrounding whitespace */
  text: string
  lead: string
  trail: string
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'CODE'])
const MAX_SEGMENTS = 800

/** The text worth translating under `root`, in reading order */
export function collectSegments(root: Node): Segment[] {
  const doc = root.ownerDocument ?? (root as Document)
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      for (let el = node.parentElement; el && el !== root; el = el.parentElement) if (SKIP.has(el.tagName)) return NodeFilter.FILTER_REJECT
      // Only text with words in it: no lone numbers, symbols or blank space
      return /\p{L}{2}/u.test(node.nodeValue ?? '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    }
  })
  const segments: Segment[] = []
  while (walker.nextNode() && segments.length < MAX_SEGMENTS) {
    const node = walker.currentNode as Text
    const value = node.nodeValue ?? ''
    const text = value.trim()
    segments.push({ node, text, lead: value.slice(0, value.indexOf(text)), trail: value.slice(value.indexOf(text) + text.length) })
  }
  return segments
}

export interface TranslationProgress {
  from?: string
  /** Finished segments by index */
  done: Map<number, string>
}

/** Reads the streamed answer: ⟦lang:xx⟧ then ⟦0⟧…⟦1⟧…; a segment is finished once the next one starts */
export function parseTranslation(text: string, finished: boolean): TranslationProgress {
  const from = text.match(/⟦lang:([a-z]{2,3})⟧/)?.[1]
  const marks = [...text.matchAll(/⟦(\d+)⟧/g)].map(match => ({ index: Number(match[1]), start: match.index!, end: match.index! + match[0].length }))
  const done = new Map<number, string>()
  marks.forEach((mark, k) => {
    const next = marks[k + 1]
    if (next || finished) done.set(mark.index, text.slice(mark.end, next?.start).trim())
  })
  return { from, done }
}

/**
 * The wave: while a message is being translated its text shimmers, a band of
 * the accent colour sweeping across each line and down the page. Each piece
 * then settles into the new language, line after line. Injected into the
 * message frame and the app alike, since the frame has no app styles
 */
export function translateCss(primary: string) {
  return `
.lb-tr-wait {
  background-image: linear-gradient(100deg, currentColor 0 38%, ${primary} 47%, color-mix(in oklab, ${primary} 55%, white) 50%, ${primary} 53%, currentColor 62% 100%);
  background-size: 260% 100%;
  background-position: 100% 0;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: lb-tr-wave 2.2s cubic-bezier(.45, .05, .35, 1) infinite both;
  animation-delay: calc(var(--lb-tr-y, 0) * 1.1s);
}
@keyframes lb-tr-wave {
  0% { background-position: 100% 0; }
  55%, 100% { background-position: 0 0; }
}
.lb-tr-in {
  animation: lb-tr-in 640ms cubic-bezier(.2, .8, .2, 1) both;
  animation-delay: var(--lb-tr-in, 0ms);
}
@keyframes lb-tr-in {
  0% { opacity: 0; filter: blur(5px); color: ${primary}; }
  40% { opacity: 1; filter: blur(0); color: ${primary}; }
}
@media (prefers-reduced-motion: reduce) {
  .lb-tr-wait { animation: none; -webkit-text-fill-color: currentColor; opacity: .55; background: none; }
  .lb-tr-in { animation: none; }
}`
}

export function injectTranslateCss(doc: Document) {
  if (doc.getElementById('lb-translate-css')) return
  const primary = getComputedStyle(document.documentElement).getPropertyValue('--ui-color-primary-500').trim() || '#16a34a'
  const style = doc.createElement('style')
  style.id = 'lb-translate-css'
  style.textContent = translateCss(primary)
  doc.head.appendChild(style)
}

/** Restarts an element's entry animation */
export function replay(el: HTMLElement, delay: number) {
  el.classList.remove('lb-tr-wait', 'lb-tr-in')
  el.style.setProperty('--lb-tr-in', `${delay}ms`)
  void el.offsetWidth
  el.classList.add('lb-tr-in')
}
