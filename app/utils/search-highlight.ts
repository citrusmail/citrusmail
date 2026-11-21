// The words being searched for, marked inside an open message: its subject
// and its body, which sits in a frame of its own. Uses the browser's
// highlight registry (CSS Custom Highlight API) rather than wrapping words in
// elements, so the message itself is never changed and AI Translate, copying
// and the frame's height all see it as it was. Browsers without it show no marks

type Win = Window & typeof globalThis

const NAME = 'lb-search'

function textNodes(root: Element): Text[] {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: node => node.parentElement?.closest('script, style, noscript') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  })
  const nodes: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text)
  return nodes
}

/** Marks every match of `terms` in these elements; no terms clears the marks */
export function highlightIn(roots: Array<Element | null | undefined>, terms: string[]) {
  const ranges = new Map<Document, Range[]>()
  for (const root of roots) {
    if (!root) continue
    const doc = root.ownerDocument
    const list = ranges.get(doc) ?? []
    ranges.set(doc, list)
    if (!terms.length) continue
    for (const node of textNodes(root)) {
      let offset = 0
      for (const part of highlightParts(node.data, terms)) {
        if (part.hit) {
          const range = doc.createRange()
          range.setStart(node, offset)
          range.setEnd(node, offset + part.text.length)
          list.push(range)
        }
        offset += part.text.length
      }
    }
  }
  for (const [doc, list] of ranges) {
    const win = doc.defaultView as Win | null
    if (!win?.CSS?.highlights || typeof win.Highlight !== 'function') continue
    if (list.length) win.CSS.highlights.set(NAME, new win.Highlight(...list))
    else win.CSS.highlights.delete(NAME)
  }
}
