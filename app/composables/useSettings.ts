// Everything CitrusMail keeps for the account: signature, picture, appearance,
// reading and notification choices. Saved on this device's CitrusMail server,
// never in the mailbox
const _useSettings = () => {
  const toast = useToast()
  const { data: settings, refresh } = useFetch<UserSettings>('/api/settings', {
    key: 'settings',
    server: false,
    default: (): UserSettings => ({ signature: '', signatureMode: 'rich', signatureOnReplies: true })
  }) as { data: Ref<UserSettings>, refresh: () => Promise<void> }

  // The browser keeps a copy of your appearance so the first paint is right;
  // the copy on the server is what follows you to another device
  const { $appearance } = useNuxtApp()
  watch(() => settings.value.appearance, (value) => {
    if (value && JSON.stringify(value) !== JSON.stringify($appearance.value)) $appearance.value = { ...value }
  })

  /** Pass `saved: false` to save without a toast, for choices that show on screen as they're made */
  async function save(patch: Partial<UserSettings>, saved: string | false = 'Settings saved') {
    try {
      settings.value = await $fetch<UserSettings>('/api/settings', { method: 'PATCH', body: patch })
      if (saved) toast.add({ title: saved, icon: 'i-lucide-check' })
      return true
    } catch (error) {
      const message = (error as { data?: { message?: string } }).data?.message
      toast.add({ title: 'Couldn’t save', description: message, color: 'error', icon: 'i-lucide-circle-alert' })
      return false
    }
  }

  return { settings, refresh, save }
}

export const useSettings = createAppComposable(_useSettings)
