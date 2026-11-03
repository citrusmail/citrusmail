/**
 * A stand-in for the editor while its text is translated. The editor keeps
 * its own DOM, and rewriting it piece by piece would redraw everything on
 * each piece, so a copy takes its place: the wave and the fade play on the
 * copy, the editor gets the finished text in one go, and the copy steps
 * aside once both read the same
 */
export interface Stage {
  pieces: { span: HTMLSpanElement, lead: string, trail: string }[]
  /** Swaps piece `index` to `text`, fading it in */
  set: (index: number, text: string, delay?: number) => void
  /** Removes the copy and shows the editor again */
  end: () => void
}

export function openStage(live: HTMLElement, expected: string[], wave: boolean): Stage | undefined {
  const copy = live.cloneNode(true) as HTMLElement
  copy.removeAttribute('contenteditable')
  copy.setAttribute('aria-hidden', 'true')
  const segments = collectSegments(copy)
  // Only when the copy holds exactly the text being translated
  if (segments.length !== expected.length || segments.some((segment, i) => segment.text !== expected[i])) return undefined

  injectTranslateCss(document)
  live.after(copy)
  live.style.display = 'none'
  const height = Math.max(1, copy.scrollHeight)
  const top = copy.getBoundingClientRect().top
  const pieces = segments.map((segment) => {
    const span = document.createElement('span')
    span.className = wave ? 'lb-tr lb-tr-wait' : 'lb-tr'
    segment.node.replaceWith(span)
    span.append(segment.node)
    span.style.setProperty('--lb-tr-y', ((span.getBoundingClientRect().top - top) / height).toFixed(3))
    return { span, lead: segment.lead, trail: segment.trail }
  })

  return {
    pieces,
    set(index, text, delay = 0) {
      const piece = pieces[index]
      if (!piece) return
      piece.span.textContent = piece.lead + text + piece.trail
      replay(piece.span, delay)
    },
    end() {
      copy.remove()
      live.style.removeProperty('display')
    }
  }
}

/** Time for the last piece's fade to finish */
export const SETTLE_MS = 700
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
