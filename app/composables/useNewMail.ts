type NewMessage = MessageSummary & { mailbox: string }
type Cursors = Record<string, Record<string, number>>

const VISIBLE_EVERY = 45_000
const HIDDEN_EVERY = 90_000
/** Up to this many new messages get a banner each; more become one summary */
const EACH = 3

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
  const desktop = import.meta.client ? window.citrusDesktop : undefined

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

  /** Where a message lives in the app: its folder, with the message selected */
  const pathTo = (folder: string, id?: string) => `/mail/${encodeURIComponent(folder)}${id ? `?m=${encodeURIComponent(id)}` : ''}`

  /** Shows a message, switching mailbox first when it's in another one. No `id` opens the folder */
  function open(target: { mailbox: string, folder: string, id?: string }) {
    window.focus()
    const path = pathTo(target.folder, target.id)
    if (target.mailbox !== account.value?.email.toLowerCase()) return switchTo(target.mailbox, path)
    navigateTo(path)
  }

  function announce(messages: NewMessage[]) {
    const p = prefs.value
    if (!p.enabled || inQuietHours(p)) return
    playSound(p.sound, p.volume)

    const newest = messages[messages.length - 1]!
    const away = document.hidden || !document.hasFocus()

    if (p.banners && away) {
      banners(messages, p.preview)
    } else if (p.inApp && !away) {
      const more = messages.length > 1 ? ` and ${messages.length - 1} more` : ''
      const title = p.preview ? `${personName(newest.from)}${more}` : messages.length > 1 ? `${messages.length} new messages` : 'New message'
      const body = p.preview ? newest.subject || '(No subject)' : ''
      toast.add({ title, description: body, avatar: p.preview ? { alt: personName(newest.from) } : undefined, icon: p.preview ? undefined : 'i-lucide-mail', actions: [{ label: 'Open', color: 'neutral', variant: 'outline', onClick: () => open(newest) }] })
    }
  }

  // System banners: one per message when there are a few, so each click
  // lands on its own message; a single summary when a lot came in at once.
  // In the Mac app they come from the app itself (see desktop/main.mjs), so
  // they show with the window closed and clicking one brings it back
  function banners(messages: NewMessage[], preview: boolean) {
    const each = preview && messages.length <= EACH
    const list = each
      ? messages.map(message => ({ title: personName(message.from), body: message.subject || '(No subject)', open: { mailbox: message.mailbox, folder: message.folder, id: message.id } }))
      : [{ title: messages.length > 1 ? `${messages.length} new messages` : 'New message', body: preview ? messages.map(message => personName(message.from)).filter((name, i, all) => all.indexOf(name) === i).slice(0, 4).join(', ') : '', open: { mailbox: messages[0]!.mailbox, folder: messages[0]!.folder, id: messages.length === 1 ? messages[0]!.id : undefined } }]

    for (const notice of list) {
      if (desktop) {
        desktop.notify(notice).catch(() => {})
      } else if ('Notification' in window && Notification.permission === 'granted') {
        const banner = new Notification(notice.title, { body: notice.body, tag: `citrusmail-${notice.open.mailbox}-${notice.open.id ?? 'summary'}`, icon: '/icon-512.png' })
        banner.onclick = () => open(notice.open)
      }
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

  let stopOpen: (() => void) | undefined
  onMounted(() => {
    // The tab holding the lock watches; the others wait their turn
    if (navigator.locks) navigator.locks.request('citrusmail-new-mail', () => new Promise<void>(() => start()))
    else start()
    // A clicked banner in the Mac app says which message to show
    stopOpen = desktop?.onOpen(target => open({ ...target, id: target.id || undefined }))
  })
  onBeforeUnmount(() => {
    clearTimeout(timer)
    stopOpen?.()
  })
  useEventListener(document, 'visibilitychange', () => !document.hidden && timer && start())

  return { check }
}
