// Settings → AI: saving, choosing and removing provider keys
export function useAiKeys() {
  const { status } = useAi()
  const toast = useToast()
  const saving = ref<AiProvider>()

  async function put(body: { provider: AiProvider, key?: string, model?: string, use?: boolean }, done: string) {
    saving.value = body.provider
    try {
      status.value = await $fetch<AiStatus>('/api/ai/keys', { method: 'PUT', body })
      toast.add({ title: done, icon: 'i-lucide-check' })
      return true
    } catch (error) {
      const description = (error as { data?: { message?: string } }).data?.message
      toast.add({ title: 'Couldn’t save', description, color: 'error', icon: 'i-lucide-circle-alert' })
      return false
    } finally {
      saving.value = undefined
    }
  }

  const label = (provider: AiProvider) => status.value.providers.find(item => item.provider === provider)?.label ?? provider

  return {
    status,
    saving,
    saveKey: (provider: AiProvider, key: string, model: string) => put({ provider, key: key || undefined, model, use: !status.value.active }, `${label(provider)} key saved`),
    use: (provider: AiProvider) => put({ provider, use: true }, `AI features now use ${label(provider)}`),
    remove: (provider: AiProvider) => put({ provider, key: '' }, `${label(provider)} key removed`)
  }
}
