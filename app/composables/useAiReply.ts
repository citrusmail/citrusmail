// AI Reply: the model writes a reply into the composer as you watch, then
// quick changes ("Shorter", "Warmer") rewrite it in place
export const QUICK_EDITS = [
  { label: 'Shorter', icon: 'i-lucide-minimize-2', change: 'Make it noticeably shorter.' },
  { label: 'Longer', icon: 'i-lucide-maximize-2', change: 'Add a little more detail and context.' },
  { label: 'Warmer', icon: 'i-lucide-smile', change: 'Make the tone warmer and friendlier.' },
  { label: 'More formal', icon: 'i-lucide-briefcase', change: 'Make the tone more formal and professional.' },
  { label: 'Say yes', icon: 'i-lucide-check', change: 'Accept or agree to what was asked.' },
  { label: 'Decline politely', icon: 'i-lucide-x', change: 'Politely decline what was asked.' }
]

const _useAiReply = () => {
  const toast = useToast()
  const { stream } = useAi()
  const { draft, editor, reply } = useComposer()

  const writing = ref(false)
  const written = ref(false)
  const instruction = ref('')
  const lastChange = ref('')
  let controller: AbortController | undefined

  // A new message in the composer starts the AI panel over
  watch(() => draft.value.replyingTo, () => {
    written.value = false
    instruction.value = ''
  })

  async function run(body: Record<string, unknown>) {
    const source = draft.value.replyingTo
    if (!source) return
    controller?.abort()
    controller = new AbortController()
    writing.value = true
    editor.value?.setEditable(false)
    try {
      const text = await stream('/api/ai/reply', { ...source, ...body }, (sofar) => {
        draft.value.html = textToHtml(sofar)
      }, controller.signal)
      draft.value.html = textToHtml(text)
      written.value = true
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.add({ title: 'AI Reply didn’t work', description: (error as Error).message, color: 'error', icon: 'i-lucide-circle-alert' })
      }
    } finally {
      writing.value = false
      editor.value?.setEditable(true)
      editor.value?.commands.focus('end')
    }
  }

  function write() {
    lastChange.value = ''
    return run({ instruction: instruction.value.trim() || undefined })
  }

  function tweak(change: string) {
    lastChange.value = change
    const current = editor.value?.getText({ blockSeparator: '\n\n' }) ?? ''
    return run({ draft: current, tweak: change })
  }

  function stop() {
    controller?.abort()
  }

  /** From a message: opens the reply and starts writing it */
  async function replyWithAi(message: MessageDetail, all = false) {
    reply(message, all)
    await nextTick()
    await write()
  }

  return { writing, written, instruction, lastChange, write, tweak, stop, replyWithAi }
}

export const useAiReply = createAppComposable(_useAiReply)
