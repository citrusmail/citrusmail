// Messages already read from the server, so opening one is instant. Besides
// the ones opened, the reader fetches ahead: the messages around the open one
// and any you rest the pointer on. Those are fetched with `peek`, which leaves
// them unread until they're actually opened. A message's content never
// changes, so a copy stays good; read and flagged live on the list instead

const KEEP = 60
/** Fetches ahead at most this many at once, so they never crowd out what you click */
const AHEAD = 2

interface Entry {
  message: MessageDetail
  /** Whether the server marked it read when it was fetched */
  marked: boolean
}

const _useMessageCache = () => {
  const { account } = useShell()
  const entries = new Map<string, Entry>()
  const inFlight = new Map<string, Promise<Entry>>()
  const queue: { folder: string, id: string }[] = []
  let ahead = 0

  const keyOf = (folder: string, id: string, images: boolean) => `${account.value?.email}\0${folder}\0${id}\0${images ? 1 : 0}`

  function keep(key: string, entry: Entry) {
    entries.delete(key)
    entries.set(key, entry)
    while (entries.size > KEEP) entries.delete(entries.keys().next().value!)
  }

  function request(folder: string, id: string, images: boolean, peek: boolean): Promise<Entry> {
    const key = keyOf(folder, id, images)
    const running = inFlight.get(key)
    if (running) return running
    const promise = $fetch<MessageDetail>(`/api/messages/${encodeURIComponent(id)}`, {
      query: { folder, images: images ? 1 : undefined, peek: peek ? 1 : undefined }
    })
      .then((message) => {
        const entry = { message, marked: !peek }
        keep(key, entry)
        return entry
      })
      .finally(() => inFlight.delete(key))
    inFlight.set(key, promise)
    return promise
  }

  /** The copy on hand, if there is one */
  function cached(folder: string, id: string, images = false): Entry | undefined {
    return entries.get(keyOf(folder, id, images))
  }

  /** Opens a message: the copy on hand, one already on its way, or the server */
  function open(folder: string, id: string, images = false): Promise<Entry> {
    return Promise.resolve(cached(folder, id, images) ?? request(folder, id, images, false))
  }

  function drain() {
    while (ahead < AHEAD && queue.length) {
      const { folder, id } = queue.shift()!
      if (cached(folder, id) || inFlight.has(keyOf(folder, id, false))) continue
      ahead++
      request(folder, id, false, true).catch(() => {}).finally(() => {
        ahead--
        drain()
      })
    }
  }

  /** Fetches messages ahead without marking them read, newest wish first */
  function prefetch(items: { folder: string, id: string }[]) {
    for (const item of [...items].reverse()) {
      const index = queue.findIndex(entry => entry.folder === item.folder && entry.id === item.id)
      if (index !== -1) queue.splice(index, 1)
      queue.unshift(item)
    }
    queue.splice(12)
    drain()
  }

  // Another mailbox is another set of messages
  watch(() => account.value?.email, () => {
    entries.clear()
    queue.length = 0
  })

  return { cached, open, prefetch }
}

export const useMessageCache = createAppComposable(_useMessageCache)

/**
 * Fetches a message ahead when the pointer rests on its row for a moment:
 * by the time it's clicked, it's here. Rows carry their id in data-id
 */
export function usePrefetchOnHover(target: Ref<HTMLElement | undefined>) {
  const { messages } = useMail()
  const { prefetch } = useMessageCache()
  let timer: ReturnType<typeof setTimeout> | undefined
  useEventListener(target, 'pointerover', (event: PointerEvent) => {
    const id = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-id]')?.dataset.id
    clearTimeout(timer)
    if (!id) return
    timer = setTimeout(() => {
      const message = messages.value.find(row => row.id === id)
      if (message) prefetch([{ folder: message.folder, id }])
    }, 80)
  })
}
