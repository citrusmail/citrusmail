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
    }
  }) as typeof $fetch
})
