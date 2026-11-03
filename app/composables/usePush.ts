// Push to this browser, even with CitrusMail closed. Needs a service worker
// and a browser push service, so it's only offered in a browser (the desktop
// app has no push service; it notifies by itself while it's running) on a
// secure page
export function usePush() {
  const desktop = import.meta.client && 'citrusDesktop' in window
  const supported = import.meta.client && !desktop && 'serviceWorker' in navigator && 'PushManager' in window && window.isSecureContext
  const permission = ref<NotificationPermission>(import.meta.client && 'Notification' in window ? Notification.permission : 'default')

  async function askPermission() {
    if (!('Notification' in window)) return 'denied' as const
    permission.value = await Notification.requestPermission()
    return permission.value
  }

  function keyBytes(base64: string) {
    const padded = (base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')
    return Uint8Array.from(atob(padded), char => char.charCodeAt(0))
  }

  const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) => !!a && a.byteLength === b.length && new Uint8Array(a).every((byte, i) => byte === b[i])

  /** Subscribes this browser (or renews it) and tells the server. Throws with the browser's reason */
  async function subscribe() {
    if (!supported) throw new Error('This browser can’t receive push here.')
    if (await askPermission() !== 'granted') throw new Error('Notifications are blocked for this site. Allow them in your browser’s site settings.')
    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    const { publicKey } = await $fetch<{ publicKey: string }>('/api/push/key')
    const key = keyBytes(publicKey)
    let subscription = await registration.pushManager.getSubscription()
    // Made with a key this server no longer has: pushes to it would be refused
    if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
      await subscription.unsubscribe()
      subscription = null
    }
    subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
    await $fetch('/api/push/subscribe', {
      method: 'POST',
      body: { subscription: subscription.toJSON(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
    })
  }

  async function unsubscribe() {
    if (!supported) return
    const registration = await navigator.serviceWorker.getRegistration('/sw.js')
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return
    await $fetch('/api/push/unsubscribe', { method: 'POST', body: { endpoint: subscription.endpoint } }).catch(() => {})
    await subscription.unsubscribe()
  }

  return { desktop, supported, permission, askPermission, subscribe, unsubscribe }
}
