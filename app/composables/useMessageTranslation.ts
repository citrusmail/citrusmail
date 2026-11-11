type State = 'idle' | 'translating' | 'translated' | 'original' | 'error'

interface Piece extends Segment {
  span: HTMLSpanElement
  translated?: string
}

// AI Translate for the message being read. The text waves in the accent
// colour while the model works, then each piece settles into the new
// language. Translations are kept (on the server, and which messages you
// translated in this browser), and the original is one click away
// `roots` are the places its text lives, in reading order: the subject, then the body
export function useMessageTranslation(message: () => MessageDetail | undefined, roots: () => (HTMLElement | null | undefined)[]) {
  const { ready } = useAi()
  const { target, translate } = useTranslator()
  const { remember, recall, forget } = useTranslationMemory()

  const state = ref<State>('idle')
  const from = ref<string>()
  const detected = ref<string>()
  const error = ref('')
  let pieces: Piece[] = []
  let controller: AbortController | undefined

  /** Written in a language other than yours */
  const foreign = computed(() => !!detected.value && detected.value !== target.value)

  const present = () => roots().filter((el): el is HTMLElement => !!el)

  // The wave starts at the subject and runs down through the body
  function wrap(els: HTMLElement[]) {
    pieces = els.flatMap((el, index) => {
      injectTranslateCss(el.ownerDocument)
      const height = Math.max(1, el.scrollHeight)
      const top = el.getBoundingClientRect().top
      const offset = index ? 0.08 : 0
      return collectSegments(el).map((segment) => {
        const span = el.ownerDocument.createElement('span')
        span.className = 'lb-tr lb-tr-wait'
        segment.node.replaceWith(span)
        span.append(segment.node)
        span.style.setProperty('--lb-tr-y', (offset + (span.getBoundingClientRect().top - top) / height).toFixed(3))
        return { ...segment, span }
      })
    })
  }

  /** Puts the original text back wherever the page still shows a piece (the subject outlives a redrawn body) */
  function unwrap() {
    for (const piece of pieces) {
      if (piece.span.isConnected) piece.span.replaceWith(piece.span.ownerDocument.createTextNode(piece.lead + piece.text + piece.trail))
    }
    pieces = []
  }

  function show(which: 'translated' | 'original') {
    let shown = 0
    for (const piece of pieces) {
      const text = which === 'translated' ? piece.translated : piece.text
      if (!text) continue
      piece.span.textContent = piece.lead + text + piece.trail
      replay(piece.span, Math.min(shown++ * 30, 900))
    }
    state.value = which
  }

  async function run() {
    const els = present()
    const current = message()
    if (!els.length || !current || state.value === 'translating') return
    if (pieces.some(piece => piece.translated)) {
      show('translated')
      if (from.value) remember(current, from.value, target.value)
      return
    }

    controller?.abort()
    controller = new AbortController()
    // A retry reuses the pieces already wrapped
    if (pieces.length) pieces.forEach(piece => piece.span.classList.replace('lb-tr-in', 'lb-tr-wait') || piece.span.classList.add('lb-tr-wait'))
    else wrap(els)
    if (!pieces.length) return
    state.value = 'translating'
    error.value = ''
    let shown = 0
    try {
      const source = await translate(pieces.map(piece => piece.text), target.value, {
        onLanguage: code => (from.value = code),
        onSegment: (index, text) => {
          const piece = pieces[index]!
          piece.translated = text
          piece.span.textContent = piece.lead + text + piece.trail
          replay(piece.span, Math.min(shown++ * 18, 400))
        }
      }, controller.signal)
      // Anything the model skipped stays as it was, without the wave
      pieces.filter(piece => !piece.translated).forEach(piece => piece.span.classList.remove('lb-tr-wait'))
      from.value = source ?? detected.value
      state.value = 'translated'
      remember(current, from.value ?? '', target.value)
    } catch (failure) {
      pieces.forEach(piece => piece.span.classList.remove('lb-tr-wait'))
      if ((failure as Error).name === 'AbortError') {
        state.value = 'idle'
        return
      }
      error.value = (failure as Error).message
      state.value = 'error'
    }
  }

  function stop() {
    controller?.abort()
  }

  function showOriginal() {
    show('original')
    const current = message()
    if (current) forget(current)
  }

  function toggle() {
    if (state.value === 'translated') showOriginal()
    else run()
  }

  /** The body was drawn (again): read its language, and translate again if you had */
  function rendered() {
    const translatedBefore = state.value === 'translated' || state.value === 'translating'
    controller?.abort()
    unwrap()
    state.value = 'idle'
    const current = message()
    const body = present().at(-1)
    if (!current || !body) return
    // What the sender wrote, not the message quoted under it; innerText leaves out an HTML body's styles
    const text = current.text || (body as HTMLElement).innerText || body.textContent || ''
    detected.value = detectLanguage(`${current.subject}\n${writtenPart(text)}`)
    const memory = recall(current)
    if (ready.value && (translatedBefore || (memory && memory.to === target.value))) nextTick(run)
  }

  // Another message: nothing about the last one's language carries over while the new body draws
  watch(() => message()?.id, (id, before) => {
    if (id === before) return
    controller?.abort()
    unwrap()
    state.value = 'idle'
    detected.value = undefined
    from.value = undefined
    error.value = ''
  })

  onBeforeUnmount(() => controller?.abort())

  return { state, from, detected, foreign, error, target, run, stop, toggle, showOriginal, showTranslation: () => show('translated'), rendered }
}
