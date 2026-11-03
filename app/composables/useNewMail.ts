type NewMessage = MessageSummary & { mailbox: string }
type Cursors = Record<string, Record<string, number>>

const VISIBLE_EVERY = 45_000
const HIDDEN_EVERY = 90_000

// Watches every signed-in mailbox for new mail and lets you know the ways you
// chose in Settings → Notifications. Only one tab watches at a time
export function useNewMail() {
  const { settings } = useSettings()
  const { account } = useShell()
  const { refreshFolders } = useMail()
  const { switchTo } = useMailboxes()
  const toast = useToast()
  const cursors = useLocalStorage<Cursors>('citrusmail-notify-cursors', {})
  const prefs = computed(() => ({ ...DEFAULT_NOTIFICATIONS, ...settings.value.notifications }))

  async function check() {
    if (!account.value) return
    const result = await $fetch<{ cursors: Cursors, messages: NewMessage[] }>('/api/notifications/check', { method: 'POST', body: { cursors: cursors.value } }).catch(() => undefined)
    if (!result) return
    cursors.value = result.cursors
    if (result.messages.length) {
      refreshFolders()
      announce(result.messages)
    }
  }

  function open(message: NewMessage) {
    window.focus()
    if (message.mailbox !== account.value?.email.toLowerCase()) return switchTo(message.mailbox)
    navigateTo({ path: `/mail/${encodeURIComponent(message.folder)}`, query: { m: message.id } })
  }

  function announce(messages: NewMessage[]) {
    const p = prefs.value
    if (!p.enabled || inQuietHours(p)) return
    playSound(p.sound, p.volume)

    const first = messages[messages.length - 1]!
    const more = messages.length > 1 ? ` and ${messages.length - 1} more` : ''
    const title = p.preview ? `${personName(first.from)}${more}` : messages.length > 1 ? `${messages.length} new messages` : 'New message'
    const body = p.preview ? first.subject || '(No subject)' : ''
    const away = document.hidden || !document.hasFocus()

    if (p.banners && away && 'Notification' in window && Notification.permission === 'granted') {
      const banner = new Notification(title, { body, tag: `citrusmail-${first.mailbox}`, icon: '/icon-512.png' })
      banner.onclick = () => open(first)
    } else if (p.inApp && !away) {
      toast.add({ title, description: body, avatar: p.preview ? { alt: personName(first.from) } : undefined, icon: p.preview ? undefined : 'i-lucide-mail', actions: [{ label: 'Open', color: 'neutral', variant: 'outline', onClick: () => open(first) }] })
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      await check()
      schedule()
    }, document.hidden ? HIDDEN_EVERY : VISIBLE_EVERY)
  }

  function start() {
    check()
    schedule()
  }

  onMounted(() => {
    // The tab holding the lock watches; the others wait their turn
    if (navigator.locks) navigator.locks.request('citrusmail-new-mail', () => new Promise<void>(() => start()))
    else start()
  })
  onBeforeUnmount(() => clearTimeout(timer))
  useEventListener(document, 'visibilitychange', () => !document.hidden && timer && start())

  return { check }
}
