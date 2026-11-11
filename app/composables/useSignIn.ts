export interface SignInForm {
  email: string
  password: string
  name: string
  username: string
  incoming: AccountSettings['incoming']
  outgoing: ServerSettings
  caldav: string
  carddav: string
}

// The sign-in page: discovery runs as the address is typed, so by the time
// the password is in, the servers are known and the form only shows them
// when someone opens the advanced settings
export function useSignIn() {
  const { fetch: refreshSession, loggedIn } = useUserSession()
  const config = useRuntimeConfig()
  const route = useRoute()
  /** Adding a mailbox next to the ones already signed in */
  const adding = computed(() => loggedIn.value && Boolean(route.query.add))

  const locked = computed(() => !!config.public.mail?.locked)

  const form = reactive<SignInForm>({
    email: '',
    password: '',
    name: '',
    username: '',
    incoming: { protocol: 'imap', host: '', port: 993, security: 'tls' },
    outgoing: { host: '', port: 465, security: 'tls' },
    caldav: '',
    carddav: ''
  })

  const discovery = ref<DiscoveryResult | null>(null)
  const discovering = ref(false)
  const advancedOpen = ref(false)
  // Fields the person changed by hand are never overwritten by discovery
  const touched = ref(false)
  // Sign in with Microsoft comes back here with what went wrong, if anything
  const error = ref(typeof route.query.error === 'string' ? route.query.error : '')
  const submitting = ref(false)

  /** The provider that takes no password, once discovery has said so */
  const oauth = computed(() => discovery.value?.oauth)
  /** Where the Sign in with Microsoft button goes: the server starts the flow */
  const oauthUrl = computed(() => {
    const query = new URLSearchParams({ ...(isEmail(form.email) ? { email: form.email.trim() } : {}), ...(adding.value ? { add: '1' } : {}) })
    return `/api/oauth/${oauth.value}?${query}`
  })

  const email = refDebounced(toRef(form, 'email'), 450)

  watch(email, async (value) => {
    discovery.value = null
    if (!isEmail(value) || locked.value) return

    discovering.value = true
    try {
      const result = await $fetch<DiscoveryResult>('/api/discover', { method: 'POST', body: { email: value } })
      if (value !== form.email) return
      discovery.value = result
      if (!touched.value) {
        // A JMAP server goes first, as the server will try it first
        const incoming = (result.jmap && !result.oauth ? jmapIncoming(result.jmap) : undefined) ?? result.incoming
        if (incoming) form.incoming = { ...incoming }
        if (result.outgoing) form.outgoing = { ...result.outgoing }
        form.caldav = result.caldav ?? ''
        form.carddav = result.carddav ?? ''
      }
    } catch {
      // Sign-in still works: the server runs discovery again, and the
      // advanced settings are there when it can't
    } finally {
      discovering.value = false
    }
  })

  /** Discovery found both: switch between JMAP (the default) and IMAP */
  function chooseJmap(jmap: boolean) {
    const found = discovery.value
    const incoming = jmap ? found?.jmap && jmapIncoming(found.jmap) : found?.incoming
    if (!incoming) return
    form.incoming = { ...incoming }
    touched.value = true
  }

  async function submit() {
    error.value = ''
    submitting.value = true
    try {
      await $fetch('/api/session', {
        method: 'POST',
        body: {
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim() || undefined,
          add: adding.value || undefined,
          ...(touched.value || advancedOpen.value
            ? {
                username: form.username.trim() || undefined,
                incoming: form.incoming.host ? form.incoming : undefined,
                outgoing: form.outgoing.host ? form.outgoing : undefined,
                caldav: form.caldav.trim() || undefined,
                carddav: form.carddav.trim() || undefined
              }
            : {})
        }
      })
      // A fresh load, so the new mailbox starts with nothing of the last one on screen
      if (adding.value) return window.location.assign('/mail/INBOX')
      await refreshSession()
      await navigateTo('/mail/INBOX')
    } catch (failure) {
      const data = (failure as { data?: { message?: string } }).data
      error.value = data?.message ?? 'Couldn’t sign in. Check your connection and try again.'
      // A server the discovery got wrong is the usual reason, so the
      // settings come forward with the error
      if (!discovery.value?.incoming) advancedOpen.value = true
    } finally {
      submitting.value = false
    }
  }

  return { form, adding, locked, discovery, discovering, advancedOpen, touched, error, submitting, submit, oauth, oauthUrl, chooseJmap }
}
