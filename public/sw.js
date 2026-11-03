// CitrusMail's service worker: shows push notifications for new mail and
// opens the message when one is clicked. It caches nothing
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'New mail' }
  }
  event.waitUntil((async () => {
    // An open, focused window already told you
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (windows.some(client => client.focused)) return
    await self.registration.showNotification(data.title || 'New mail', {
      body: data.body || '',
      tag: data.tag,
      icon: '/icon-512.png',
      badge: '/icon-512.png',
      data: { url: data.url || '/mail/INBOX' }
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/mail/INBOX', self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = windows.find(client => new URL(client.url).origin === self.location.origin)
    if (open) {
      await open.focus()
      return open.navigate(url)
    }
    return self.clients.openWindow(url)
  })())
})
