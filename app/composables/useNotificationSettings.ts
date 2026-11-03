// Settings → Notifications. Each change saves on its own, quietly
export function useNotificationSettings() {
  const { settings, save } = useSettings()
  const push = usePush()
  const toast = useToast()
  const prefs = computed<NotificationSettings>(() => ({ ...DEFAULT_NOTIFICATIONS, ...settings.value.notifications }))

  function set(patch: Partial<NotificationSettings>) {
    return save({ notifications: { ...prefs.value, ...patch } }, false)
  }

  async function setBanners(on: boolean) {
    if (on && push.permission.value !== 'granted' && await push.askPermission() !== 'granted') {
      toast.add({ title: 'Banners are blocked for this site', description: 'Allow notifications in your browser’s site settings, then turn this on again.', color: 'warning', icon: 'i-lucide-bell-off' })
      return
    }
    set({ banners: on })
  }

  async function setPush(on: boolean) {
    if (!on) {
      await push.unsubscribe()
      return set({ push: false })
    }
    // Saved first: the server checks this before each push
    await set({ push: true })
    try {
      await push.subscribe()
    } catch (error) {
      await set({ push: false })
      toast.add({ title: 'Push couldn’t be turned on', description: (error as Error).message, color: 'warning', icon: 'i-lucide-bell-off', duration: 10_000 })
    }
  }

  // Renewed on each launch, so mailboxes added since, or a server that lost
  // the subscription, still get pushes
  function renewPush() {
    if (prefs.value.push && push.supported && push.permission.value === 'granted') push.subscribe().catch(() => {})
  }

  return { prefs, set, setBanners, setPush, renewPush, desktop: push.desktop, pushSupported: push.supported, permission: push.permission }
}
