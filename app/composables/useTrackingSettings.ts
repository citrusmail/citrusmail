// Settings → Tracking: whether new messages are tracked, and the tracking
// image's public address, which is checked from the outside before it's used
export function useTrackingSettings() {
  const { settings, save } = useSettings()
  const desktop = import.meta.client && 'citrusDesktop' in window

  const receipts = computed<ReceiptSettings>(() => ({ default: false, images: false, origin: '', ...settings.value.receipts }))
  const imageReady = computed(() => trackingReady(receipts.value))
  // A Faivelo mailbox can have Faivelo serve the image instead
  const { data: faivelo } = useFetch<{ available: boolean }>('/api/receipts/faivelo', { key: 'tracking-faivelo', default: () => ({ available: false }) })

  // Where this page is open, when that looks reachable from the internet
  function suggestedOrigin() {
    if (!import.meta.client || location.protocol !== 'https:') return ''
    const host = location.hostname
    const local = host === 'localhost' || /\.(local|localhost|test|internal|lan|home)$/.test(host) || /^(\d+\.){3}\d+$|:/.test(host)
    return local ? '' : location.origin
  }

  // Opened from this computer (localhost, a home network): nobody else can reach it
  const local = import.meta.client && !suggestedOrigin()
  const address = ref(receipts.value.origin || suggestedOrigin())
  // Settings can arrive after the page opens
  watch(() => receipts.value.origin, (origin) => {
    if (origin && !address.value) address.value = origin
  })
  const checking = ref(false)
  const result = ref<{ ok: boolean, message: string }>()

  function set(patch: Partial<ReceiptSettings>, saved: string | false = 'Saved') {
    return save({ receipts: { ...receipts.value, ...patch } }, saved)
  }

  async function check() {
    if (!address.value.trim()) return
    checking.value = true
    result.value = undefined
    try {
      const value = /^https?:\/\//i.test(address.value.trim()) ? address.value.trim() : `https://${address.value.trim()}`
      const answer = await $fetch<{ ok: boolean, origin?: string, message: string }>('/api/receipts/check', { method: 'POST', body: { origin: value } })
      result.value = answer
      if (answer.ok && answer.origin) {
        address.value = answer.origin
        await set({ origin: answer.origin, images: true, provider: 'self' }, 'Tracking image is on')
      }
    } catch {
      result.value = { ok: false, message: 'That doesn’t look like a web address.' }
    } finally {
      checking.value = false
    }
  }

  return { receipts, imageReady, faivelo: computed(() => faivelo.value.available), desktop, local, address, checking, result, set, check }
}
