// The streaming half of AI Translate, shared by the reader and the composer
export function useTranslator() {
  const { stream } = useAi()
  const { settings } = useSettings()
  const target = computed(() => settings.value.language || 'en')

  /**
   * Translates `segments` into `to`, calling `onSegment` as each finishes and
   * `onLanguage` once the source language is known. Resolves with the source
   */
  async function translate(texts: string[], to: string, handlers: { onSegment: (index: number, text: string) => void, onLanguage?: (code: string) => void }, signal?: AbortSignal) {
    const shown = new Set<number>()
    let from: string | undefined
    const take = (sofar: string, finished: boolean) => {
      const progress = parseTranslation(sofar, finished)
      if (progress.from && !from) {
        from = progress.from
        handlers.onLanguage?.(from)
      }
      for (const [index, text] of progress.done) {
        if (shown.has(index) || index >= texts.length || !text) continue
        shown.add(index)
        handlers.onSegment(index, text)
      }
    }
    const all = await stream('/api/ai/translate', { segments: texts, to }, sofar => take(sofar, false), signal)
    take(all, true)
    if (!shown.size) throw new Error('The translation came back empty. Try again.')
    return from
  }

  return { target, translate }
}
