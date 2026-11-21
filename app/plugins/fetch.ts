// Every API call carries the viewer's timezone (the calendar converts server
// times into it) and a lapsed session sends the viewer back to sign in
export default defineNuxtPlugin(() => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  globalThis.$fetch = $fetch.create({
    onRequest({ options }) {
      options.headers = new Headers(options.headers)
      options.headers.set('x-timezone', timezone)
    },
    onResponseError({ request, response }) {
      const url = typeof request === 'string' ? request : request.url

      if (response.status === 401 && !url.includes('/api/session') && !url.includes('/api/_auth')) {
        navigateTo('/login')
      }
      // The server moved a mailbox from JMAP to IMAP (JMAP is down): the app
      // starts over, since its message ids changed. Once a minute at most
      const data = (response._data as { data?: { protocolSwitched?: boolean } } | undefined)?.data
      if (response.status === 503 && data?.protocolSwitched) {
        const last = Number(sessionStorage.getItem('citrusmail-protocol-reload') ?? 0)
        if (Date.now() - last < 60_000) return
        sessionStorage.setItem('citrusmail-protocol-reload', String(Date.now()))
        location.reload()
      }
    }
  }) as typeof $fetch
})
