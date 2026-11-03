// Your reply, in the language the message you're answering was written in.
// The text shimmers, then each piece fades into the new language in place;
// Undo fades your own words back the same way
const _useReplyTranslation = () => {
  const toast = useToast()
  const { draft, editor } = useComposer()
  const { translate } = useTranslator()

  const translating = ref(false)
  /** No stand-in could be made, so the plain wave over the whole editor plays instead */
  const fallback = ref(false)
  const original = ref<string>()
  let originals: string[] = []
  let translations: string[] = []
  let controller: AbortController | undefined
  let stage: Stage | undefined

  watch(() => draft.value.replyingTo, () => {
    controller?.abort()
    original.value = undefined
  })

  function finish() {
    stage?.end()
    stage = undefined
    translating.value = false
    fallback.value = false
    editor.value?.setEditable(true)
  }

  async function run() {
    const to = draft.value.translateTo
    const live = editor.value?.view.dom as HTMLElement | undefined
    if (!to || !live) return
    const html = draft.value.html
    const root = new DOMParser().parseFromString(`<div id="reply">${html}</div>`, 'text/html').getElementById('reply')!
    const segments = collectSegments(root)
    if (!segments.length) {
      toast.add({ title: 'Write your reply first', description: `Then it can be translated into ${languageName(to)}.`, icon: 'i-lucide-languages' })
      return
    }

    controller?.abort()
    controller = new AbortController()
    original.value = html
    originals = segments.map(segment => segment.text)
    translations = [...originals]
    translating.value = true
    editor.value?.setEditable(false)
    stage = openStage(live, originals, true)
    fallback.value = !stage
    let shown = 0
    try {
      await translate(originals, to, {
        onSegment: (index, text) => {
          translations[index] = text
          const segment = segments[index]!
          segment.node.nodeValue = segment.lead + text + segment.trail
          if (stage) stage.set(index, text, Math.min(shown++ * 18, 300))
          else draft.value.html = root.innerHTML
        }
      }, controller.signal)
      stage?.pieces.forEach(piece => piece.span.classList.remove('lb-tr-wait'))
      // The editor takes the finished text while the copy is still showing it
      draft.value.html = root.innerHTML
      if (stage) await wait(SETTLE_MS)
    } catch (failure) {
      if ((failure as Error).name !== 'AbortError') toast.add({ title: 'Couldn’t translate your reply', description: (failure as Error).message, color: 'error', icon: 'i-lucide-circle-alert' })
      draft.value.html = html
      original.value = undefined
    } finally {
      finish()
    }
  }

  async function undo() {
    if (translating.value) {
      controller?.abort()
      return
    }
    if (original.value === undefined) return
    const back = original.value
    original.value = undefined
    const live = editor.value?.view.dom as HTMLElement | undefined
    // Untouched since translating: fade each piece back. Edited: just put it back
    const reverse = live ? openStage(live, translations, false) : undefined
    if (reverse) {
      editor.value?.setEditable(false)
      originals.forEach((text, index) => reverse.set(index, text, Math.min(index * 30, 600)))
      draft.value.html = back
      await wait(Math.min(originals.length * 30, 600) + SETTLE_MS)
      reverse.end()
      editor.value?.setEditable(true)
    } else {
      draft.value.html = back
    }
  }

  return { translating, fallback, translated: computed(() => original.value !== undefined && !translating.value), run, undo }
}

export const useReplyTranslation = createAppComposable(_useReplyTranslation)
