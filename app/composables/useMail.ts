// Folders, the open folder's messages and every action on them. Actions are
// optimistic: the list changes first and is put back if the server refuses
const _useMail = () => {
  const route = useRoute()
  const router = useRouter()
  const toast = useToast()

  const { data: folders, refresh: refreshFolders } = useFetch<Folder[]>('/api/folders', {
    key: 'folders',
    default: () => [],
    server: false
  })

  const folderPath = computed(() => route.path.startsWith('/mail/') ? (route.params.folder as string || 'INBOX') : 'INBOX')
  const folder = computed(() => folders.value.find(item => item.path === folderPath.value))

  const search = ref('')
  const query = refDebounced(search, 300)
  const filter = ref<'all' | 'unread' | 'flagged'>('all')
  // Narrowing a search: who sent it, when, and whether it has files
  const filters = ref<MailFilters>({})
  const filtering = computed(() => Boolean(filters.value.from || filters.value.within || filters.value.on || filters.value.attachments))
  const filterFrom = refDebounced(computed(() => filters.value.from?.trim() || undefined), 300)

  function listQuery() {
    return {
      folder: folderPath.value,
      unread: filter.value === 'unread' ? 1 : undefined,
      flagged: filter.value === 'flagged' ? 1 : undefined,
      from: filterFrom.value,
      within: filters.value.within,
      on: filters.value.on,
      attachments: filters.value.attachments ? 1 : undefined
    }
  }

  // The last page seen of each folder, shown at once while the server is
  // asked again: on a slow mail server that's the difference between an
  // instant folder and seconds of skeletons
  const { account: shellAccount } = useShell()
  const listCache = useLocalStorage<Record<string, { at: number, page: MessagePage }>>('citrusmail-list-cache', {})
  const cacheKey = () => JSON.stringify([shellAccount.value?.email, listQuery(), query.value || ''])
  function cachePage(page: MessagePage) {
    const entries = Object.entries({ ...listCache.value, [cacheKey()]: { at: Date.now(), page: { ...page, messages: page.messages.slice(0, 50) } } })
    listCache.value = Object.fromEntries(entries.sort((a, b) => b[1].at - a[1].at).slice(0, 10))
  }

  const messages = ref<MessageSummary[]>([])
  const total = ref(0)
  const cursor = ref<string>()
  /** 'refreshing': a saved copy is on screen while the server is asked again */
  const status = ref<'idle' | 'loading' | 'refreshing' | 'more' | 'error'>('idle')

  // A request counter so a slow response for a folder already left behind
  // never lands in the one on screen
  let generation = 0

  // Messages just moved or deleted. A list request already on its way can
  // still name them; they stay off the list until the server has caught up
  const leaving = new Set<string>()
  const leaveKey = (message: MessageSummary) => `${message.folder}\0${message.id}`
  const staying = (message: MessageSummary) => !leaving.has(leaveKey(message))

  async function load(reset = true) {
    if (!reset && (!cursor.value || status.value !== 'idle')) return

    const current = ++generation
    const cached = reset ? listCache.value[cacheKey()]?.page : undefined
    if (cached) {
      messages.value = cached.messages.filter(staying)
      total.value = cached.total
      cursor.value = undefined
    }
    status.value = cached ? 'refreshing' : reset ? 'loading' : 'more'

    try {
      const page = await $fetch<MessagePage>('/api/messages', {
        query: {
          ...listQuery(),
          before: reset ? undefined : cursor.value,
          q: query.value || undefined
        }
      })
      if (current !== generation) return

      const arrived = page.messages.filter(staying)
      messages.value = reset ? arrived : [...messages.value, ...arrived]
      total.value = page.total
      cursor.value = page.cursor
      status.value = 'idle'
      if (reset) cachePage(page)
    } catch {
      // A cached page stays up when the server can't be reached
      if (current === generation) status.value = cached ? 'idle' : 'error'
    }
  }

  // New mail arrives at the top: fetch the first page again and put any
  // message not on screen yet in front, without disturbing the scroll
  async function refreshTop() {
    if (status.value !== 'idle' || query.value) return

    try {
      // Rules file new mail first, so it never flashes up in the Inbox
      const { moved } = await $fetch<{ moved: number }>('/api/rules/run', { method: 'POST' }).catch(() => ({ moved: 0 }))
      if (moved && folderPath.value === 'INBOX') {
        refreshFolders()
        return load()
      }
      const page = await $fetch<MessagePage>('/api/messages', { query: listQuery() })
      const known = new Set(messages.value.map(message => message.id))
      const fresh = page.messages.filter(message => !known.has(message.id) && staying(message))
      if (fresh.length) {
        // In date order, so a message moved in from another folder lands among its own day's mail
        messages.value = [...fresh, ...messages.value].sort((a, b) => b.date.localeCompare(a.date))
        total.value = page.total
      }
      refreshFolders()
    } catch {
      // Background refresh, the next tick tries again
    }
  }

  const visibility = useDocumentVisibility()
  // Reading, flagging and moving show up in the saved copy too
  watchDebounced(messages, (list) => {
    if (status.value !== 'idle' || !list.length) return
    cachePage({ messages: list.slice(0, 50), total: total.value, cursor: undefined })
  }, { debounce: 800, deep: true })

  const poll = useIntervalFn(refreshTop, 30_000, { immediate: false })
  watch(visibility, visible => visible === 'visible' ? (refreshTop(), poll.resume()) : poll.pause())

  // Opening a folder leaves AI search
  watch(folderPath, () => ai.value.on && exitAi())

  watch([folderPath, query, filter, filterFrom, () => filters.value.within, () => filters.value.on, () => filters.value.attachments], () => {
    if (route.path.startsWith('/mail')) load()
  })

  onNuxtReady(() => {
    // The list first; rules then file whatever came in while CitrusMail was
    // closed, and the list follows if they moved anything
    if (route.path.startsWith('/mail')) load()
    $fetch<{ moved: number }>('/api/rules/run', { method: 'POST' })
      .then(({ moved }) => {
        if (!moved) return
        refreshFolders()
        if (route.path.startsWith('/mail')) load()
      })
      .catch(() => {})
    poll.resume()
  })

  const selectedId = computed<string | undefined>({
    get: () => route.query.m as string | undefined,
    set: (id) => {
      router.replace({ query: { ...route.query, m: id || undefined } })
    }
  })

  /* AI search ------------------------------------------------------ */

  // A question asked of every folder at once. While it's on, its matches
  // take the list's place; they can come from any folder
  const ai = ref<{ on: boolean, status: 'idle' | 'loading' | 'done' | 'error', query: string, result?: AiSearchResult, error?: string }>({ on: false, status: 'idle', query: '' })

  async function askAi(question: string) {
    const q = question.trim()
    if (q.length < 2) return
    ai.value = { on: true, status: 'loading', query: q }
    try {
      const result = await $fetch<AiSearchResult>('/api/ai/search', { method: 'POST', body: { q } })
      if (ai.value.query === q) ai.value = { on: true, status: 'done', query: q, result }
    } catch (error) {
      if (ai.value.query !== q) return
      ai.value = { on: true, status: 'error', query: q, error: (error as { data?: { message?: string } }).data?.message ?? 'The search didn’t finish. Try again.' }
    }
  }

  function exitAi() {
    ai.value = { on: false, status: 'idle', query: '' }
  }

  /** What the list shows: the folder, or AI search's matches */
  const shown = computed(() => ai.value.on ? ai.value.result?.messages ?? [] : messages.value)

  const selected = computed(() => shown.value.find(message => message.id === selectedId.value) ?? messages.value.find(message => message.id === selectedId.value))

  function patchLocal(id: string, change: Partial<MessageSummary>) {
    messages.value = messages.value.map(message => message.id === id ? { ...message, ...change } : message)
    if (ai.value.result) {
      ai.value.result = { ...ai.value.result, messages: ai.value.result.messages.map(message => message.id === id ? { ...message, ...change } : message) }
    }
  }

  function adjustUnread(path: string, delta: number) {
    folders.value = folders.value.map(item => item.path === path ? { ...item, unread: Math.max(0, item.unread + delta) } : item)
  }

  async function setUnread(message: MessageSummary, unread: boolean, silent = false) {
    if (message.unread === unread) return
    patchLocal(message.id, { unread })
    adjustUnread(message.folder, unread ? 1 : -1)

    if (silent) return
    try {
      await $fetch(`/api/messages/${encodeURIComponent(message.id)}`, { method: 'PATCH', query: { folder: message.folder }, body: { unread } })
    } catch {
      patchLocal(message.id, { unread: !unread })
      adjustUnread(message.folder, unread ? -1 : 1)
      toast.add({ title: 'Couldn’t update the message', color: 'error', icon: 'i-lucide-circle-alert' })
    }
  }

  async function toggleFlag(message: MessageSummary) {
    const flagged = !message.flagged
    patchLocal(message.id, { flagged })
    try {
      await $fetch(`/api/messages/${encodeURIComponent(message.id)}`, { method: 'PATCH', query: { folder: message.folder }, body: { flagged } })
    } catch {
      patchLocal(message.id, { flagged: !flagged })
      toast.add({ title: 'Couldn’t flag the message', color: 'error', icon: 'i-lucide-circle-alert' })
    }
  }

  // Takes the message off the list and selects its neighbour, the way a
  // reader expects to keep going down the inbox
  function takeOut(message: MessageSummary) {
    const index = messages.value.findIndex(item => item.id === message.id)
    const wasSelected = selectedId.value === message.id
    const key = leaveKey(message)
    leaving.add(key)
    setTimeout(() => leaving.delete(key), 60_000)
    messages.value = messages.value.filter(item => item.id !== message.id)
    if (ai.value.result) ai.value.result = { ...ai.value.result, messages: ai.value.result.messages.filter(item => !(item.id === message.id && item.folder === message.folder)) }
    total.value = Math.max(0, total.value - 1)
    if (message.unread) adjustUnread(message.folder, -1)
    if (wasSelected) {
      selectedId.value = messages.value[index]?.id ?? messages.value[index - 1]?.id
    }
    return () => {
      leaving.delete(key)
      messages.value.splice(index, 0, message)
      total.value++
      if (message.unread) adjustUnread(message.folder, 1)
    }
  }

  const MOVE_LABELS: Record<string, string> = { archive: 'Archived', trash: 'Moved to Trash', junk: 'Moved to Junk', inbox: 'Moved to Inbox' }

  async function move(message: MessageSummary, to: string) {
    const restore = takeOut(message)
    try {
      await $fetch(`/api/messages/${encodeURIComponent(message.id)}/move`, { method: 'POST', query: { folder: message.folder }, body: { to } })
      const target = folders.value.find(item => item.path === to)
      toast.add({ title: MOVE_LABELS[to] ?? `Moved to ${target?.name ?? to}`, icon: 'i-lucide-check' })
    } catch {
      restore()
      toast.add({ title: 'Couldn’t move the message', color: 'error', icon: 'i-lucide-circle-alert' })
    }
  }

  async function remove(message: MessageSummary) {
    const restore = takeOut(message)
    try {
      await $fetch(`/api/messages/${encodeURIComponent(message.id)}`, { method: 'DELETE', query: { folder: message.folder } })
      toast.add({ title: folder.value?.role === 'trash' ? 'Deleted for good' : 'Moved to Trash', icon: 'i-lucide-trash-2' })
    } catch {
      restore()
      toast.add({ title: 'Couldn’t delete the message', color: 'error', icon: 'i-lucide-circle-alert' })
    }
  }

  // From a message's date: the Inbox, narrowed to that day
  async function showDay(iso: string) {
    const date = new Date(iso)
    const on = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    search.value = ''
    filter.value = 'all'
    filters.value = { on }
    // The open message stays open when it's already in the Inbox
    if (folderPath.value !== 'INBOX') await navigateTo(folderLink('INBOX'))
  }

  /* Folders ------------------------------------------------------- */

  const failed = (title: string) => (error: unknown) => {
    const description = (error as { data?: { message?: string } }).data?.message
    toast.add({ title, description, color: 'error', icon: 'i-lucide-circle-alert' })
    return undefined
  }

  async function createFolder(name: string, parent?: string): Promise<string | undefined> {
    const result = await $fetch<{ path: string }>('/api/folders', { method: 'POST', body: { name, parent } }).catch(failed('Couldn’t create the folder'))
    if (!result) return undefined
    await refreshFolders()
    toast.add({ title: `Created ${name}`, icon: 'i-lucide-folder-plus' })
    return result.path
  }

  async function renameFolder(target: Folder, name: string) {
    const result = await $fetch<{ path: string }>('/api/folders', { method: 'PATCH', body: { path: target.path, name } }).catch(failed('Couldn’t rename the folder'))
    if (!result) return
    await refreshFolders()
    if (folderPath.value === target.path) await navigateTo(folderLink(result.path))
  }

  async function deleteFolder(target: Folder) {
    const done = await $fetch<{ moved: number }>('/api/folders', { method: 'DELETE', query: { path: target.path } }).catch(failed('Couldn’t delete the folder'))
    if (!done) return
    if (folderPath.value === target.path) await navigateTo(folderLink('INBOX'))
    else if (folderPath.value === 'INBOX' && done.moved) await load()
    await refreshFolders()
    toast.add({
      title: `Deleted ${target.name}`,
      description: done.moved ? `${done.moved} ${done.moved === 1 ? 'message is' : 'messages are'} back in your Inbox.` : undefined,
      icon: 'i-lucide-folder-x'
    })
  }

  // j/k and the arrows walk the list, the rest act on the open message
  function step(offset: number) {
    const index = shown.value.findIndex(message => message.id === selectedId.value)
    const next = shown.value[index === -1 ? 0 : index + offset]
    if (next) selectedId.value = next.id
    if (!ai.value.on && offset > 0 && index >= messages.value.length - 5) load(false)
  }

  const onMail = () => route.path.startsWith('/mail')
  const when = (handler: () => void) => () => onMail() && handler()
  const withSelected = (handler: (message: MessageSummary) => void) => when(() => selected.value && handler(selected.value))

  defineShortcuts({
    'j': when(() => step(1)),
    'k': when(() => step(-1)),
    'arrowdown': when(() => step(1)),
    'arrowup': when(() => step(-1)),
    'e': withSelected(message => move(message, 'archive')),
    '#': withSelected(remove),
    'delete': withSelected(remove),
    'backspace': withSelected(remove),
    's': withSelected(toggleFlag),
    'shift_u': withSelected(message => setUnread(message, true))
  })

  // Escape closes the open message. A plain listener, not a shortcut: those
  // cancel the key, and an open menu or dialog has to get it first
  useEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented || !selectedId.value || !onMail()) return
    const target = event.target as HTMLElement | null
    if (target?.closest('input, textarea, [contenteditable="true"]')) return
    if (document.querySelector('[role="menu"], [role="listbox"], [role="dialog"]')) return
    selectedId.value = undefined
  })

  return {
    folders,
    refreshFolders,
    folderPath,
    folder,
    search,
    filter,
    filters,
    filtering,
    showDay,
    createFolder,
    renameFolder,
    deleteFolder,
    messages,
    total,
    cursor,
    status,
    load,
    refreshTop,
    selectedId,
    selected,
    shown,
    ai,
    askAi,
    exitAi,
    patchLocal,
    setUnread,
    toggleFlag,
    move,
    remove
  }
}

export const useMail = createAppComposable(_useMail)
