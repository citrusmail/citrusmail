export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, fetch } = useUserSession()

  if (!loggedIn.value) {
    await fetch()
  }

  if (to.path === '/login') {
    // Signed in, the sign-in page is only for adding another mailbox
    return loggedIn.value && !to.query.add ? navigateTo('/mail/INBOX') : undefined
  }

  if (!loggedIn.value) {
    return navigateTo('/login')
  }
})
