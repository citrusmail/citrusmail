// The mailboxes signed in on this browser, and moving between them. A switch
// reloads the app, so nothing from the last mailbox is left on screen
const _useMailboxes = () => {
  const { account } = useShell()
  const { clear } = useUserSession()
  const toast = useToast()

  const mailboxes = computed<MailboxSummary[]>(() => account.value?.mailboxes ?? (account.value ? [{ email: account.value.email, name: account.value.name }] : []))
  const others = computed(() => mailboxes.value.slice(1))
  const switching = ref('')

  /** Opens another signed-in mailbox, at its Inbox or at `to` (a path within the app) */
  async function switchTo(email: string, to = '/mail/INBOX') {
    if (email === account.value?.email) return
    switching.value = email
    try {
      await $fetch('/api/session/switch', { method: 'POST', body: { email } })
      window.location.assign(to.startsWith('/') && !to.startsWith('//') ? to : '/mail/INBOX')
    } catch {
      switching.value = ''
      toast.add({ title: 'Couldn’t open that mailbox', color: 'error', icon: 'i-lucide-circle-alert' })
    }
  }

  async function signOutOf(email: string) {
    const result = await $fetch<{ signedOut: boolean }>('/api/session/mailbox', { method: 'DELETE', query: { email } })
    if (result.signedOut) {
      await clear()
      return navigateTo('/login')
    }
    window.location.assign('/mail/INBOX')
  }

  async function signOutAll() {
    // This browser stops getting pushes for mailboxes it's no longer signed in to
    await usePush().unsubscribe().catch(() => {})
    await clear()
    await navigateTo('/login')
  }

  function add() {
    return navigateTo({ path: '/login', query: { add: '1' } })
  }

  return { mailboxes, others, switching, switchTo, signOutOf, signOutAll, add }
}

export const useMailboxes = createAppComposable(_useMailboxes)
