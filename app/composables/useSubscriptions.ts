// Everyone sending you list mail, with a way out of each
export function useSubscriptions() {
  const { data: subscriptions, status, refresh } = useFetch<Subscription[]>('/api/subscriptions', { key: 'subscriptions', server: false, default: () => [] })
  const { unsubscribe } = useUnsubscribe()
  const { block } = useSenders()
  const busy = ref(new Set<string>())
  const query = ref('')

  const shown = computed(() => {
    const q = query.value.trim().toLowerCase()
    return q ? subscriptions.value.filter(item => item.address.includes(q) || item.name?.toLowerCase().includes(q)) : subscriptions.value
  })

  async function leave(item: Subscription) {
    busy.value = new Set(busy.value).add(item.address)
    const done = await unsubscribe({ folder: item.folder, id: item.id }, item.name || item.address)
    if (done) subscriptions.value = subscriptions.value.map(entry => entry.address === item.address ? { ...entry, unsubscribedAt: new Date().toISOString() } : entry)
    const next = new Set(busy.value)
    next.delete(item.address)
    busy.value = next
  }

  return { subscriptions, shown, query, status, refresh, busy, leave, block }
}
