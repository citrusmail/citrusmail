// The AI features, available once a key is saved in Settings → AI. Replies
// and summaries stream in as they're written
const _useAi = () => {
  const { data: status, refresh } = useFetch<AiStatus>('/api/ai', {
    key: 'ai-status',
    server: false,
    default: () => ({ providers: [] })
  })

  const ready = computed(() => Boolean(status.value.active))
  const providerLabel = computed(() => status.value.providers.find(item => item.provider === status.value.active)?.label)

  /**
   * Streams a response from one of the /api/ai routes, calling `onText` with
   * everything written so far. Throws with the server's message on failure
   */
  async function stream(path: string, body: unknown, onText: (text: string) => void, signal?: AbortSignal): Promise<string> {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone },
      body: JSON.stringify(body),
      signal
    })
    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => ({})) as { message?: string }
      throw new Error(data.message || 'The AI couldn’t answer. Try again in a moment.')
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let text = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
      onText(text)
    }
    return text
  }

  return { status, refresh, ready, providerLabel, stream }
}

export const useAi = createAppComposable(_useAi)

/** Plain text from the model as the editor's paragraphs */
export function textToHtml(text: string) {
  return text.trim().split(/\n{2,}/).map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('')
}
