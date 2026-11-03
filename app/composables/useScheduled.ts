// Messages waiting to be sent later. The server sends them on time whether
// or not the app is open; this keeps the list on screen in step
const _useScheduled = () => {
  const toast = useToast()
  const { folders } = useMail()
  // Scheduled messages are managed at the top of the Drafts folder
  const draftsLink = computed(() => folderLink(folders.value.find(folder => folder.role === 'drafts')?.path ?? 'Drafts'))
  const { data: scheduled, refresh } = useFetch<ScheduledMessage[]>('/api/scheduled', {
    key: 'scheduled',
    server: false,
    default: () => []
  })

  // Something due in the next minute will have gone out by then
  useIntervalFn(() => {
    if (scheduled.value.some(item => new Date(item.sendAt).getTime() < Date.now() + 60_000)) refresh()
  }, 30_000)

  /** Takes it out of the outbox; the message comes back so it can be edited */
  async function cancel(item: ScheduledMessage): Promise<OutgoingMessage | undefined> {
    try {
      const message = await $fetch<OutgoingMessage>(`/api/scheduled/${item.id}`, { method: 'DELETE' })
      scheduled.value = scheduled.value.filter(entry => entry.id !== item.id)
      return message
    } catch (error) {
      const description = (error as { data?: { message?: string } }).data?.message
      toast.add({ title: 'Couldn’t cancel it', description, color: 'error', icon: 'i-lucide-circle-alert' })
      await refresh()
      return undefined
    }
  }

  /** Moves it to another time */
  async function reschedule(item: ScheduledMessage, sendAt: Date) {
    try {
      const next = await $fetch<ScheduledMessage>(`/api/scheduled/${item.id}`, { method: 'PATCH', body: { sendAt: sendAt.toISOString() } })
      scheduled.value = scheduled.value.map(entry => entry.id === item.id ? next : entry).sort((a, b) => a.sendAt.localeCompare(b.sendAt))
      toast.add({ title: `Rescheduled for ${scheduleLabel(next.sendAt)}`, icon: 'i-lucide-clock-arrow-up' })
    } catch (error) {
      const description = (error as { data?: { message?: string } }).data?.message
      toast.add({ title: 'Couldn’t reschedule it', description, color: 'error', icon: 'i-lucide-circle-alert' })
      await refresh()
    }
  }

  return { scheduled, refresh, cancel, reschedule, draftsLink }
}

export const useScheduled = createAppComposable(_useScheduled)

/** Times people actually pick: tonight, tomorrow morning or afternoon, Monday morning */
export function sendLaterPresets(now = new Date()) {
  const at = (days: number, hour: number) => {
    const date = new Date(now)
    date.setDate(date.getDate() + days)
    date.setHours(hour, 0, 0, 0)
    return date
  }
  const presets: { label: string, icon: string, date: Date }[] = []
  if (now.getHours() < 19) presets.push({ label: 'Tonight', icon: 'i-lucide-moon', date: at(0, 20) })
  presets.push(
    { label: 'Tomorrow morning', icon: 'i-lucide-sunrise', date: at(1, 8) },
    { label: 'Tomorrow afternoon', icon: 'i-lucide-sun', date: at(1, 13) }
  )
  const toMonday = (8 - now.getDay()) % 7 || 7
  if (toMonday > 1) presets.push({ label: 'Monday morning', icon: 'i-lucide-briefcase', date: at(toMonday, 8) })
  return presets
}

/** The custom picker's starting point: an hour from now, on the next 5 minutes */
export function inAnHour(now = new Date()) {
  const date = new Date(now.getTime() + 60 * 60_000)
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0)
  return date
}
