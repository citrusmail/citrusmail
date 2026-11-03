// Who always reaches your Inbox and who never does. Shared by Settings →
// Senders and the block/allow actions on a message
const _useSenders = () => {
  const toast = useToast()
  const { refreshFolders, load } = useMail()
  const { data: lists, refresh } = useFetch<SenderLists>('/api/senders', {
    key: 'senders',
    server: false,
    default: (): SenderLists => ({ allowed: [], blocked: [], blockAction: 'junk' })
  })

  async function save(next: SenderLists, done: string) {
    try {
      const result = await $fetch<{ lists: SenderLists, moved: number }>('/api/senders', { method: 'PUT', body: next })
      lists.value = result.lists
      toast.add({
        title: done,
        description: result.moved ? `${result.moved} ${result.moved === 1 ? 'message' : 'messages'} moved.` : undefined,
        icon: 'i-lucide-check'
      })
      if (result.moved) {
        refreshFolders()
        load()
      }
      return true
    } catch (error) {
      const description = (error as { data?: { message?: string } }).data?.message
      toast.add({ title: 'Couldn’t save', description, color: 'error', icon: 'i-lucide-circle-alert' })
      return false
    }
  }

  const norm = (entry: string) => entry.trim().toLowerCase()
  const without = (list: string[], entry: string) => list.filter(item => item !== norm(entry))

  function allow(entry: string) {
    return save({ ...lists.value, allowed: [...without(lists.value.allowed, entry), norm(entry)], blocked: without(lists.value.blocked, entry) }, `${entry} is on your allow list`)
  }

  function block(entry: string) {
    const action = lists.value.blockAction === 'trash' ? 'Trash' : 'Junk'
    return save({ ...lists.value, blocked: [...without(lists.value.blocked, entry), norm(entry)], allowed: without(lists.value.allowed, entry) }, `Blocked ${entry}. Their mail goes to ${action}`)
  }

  function remove(entry: string) {
    return save({ ...lists.value, allowed: without(lists.value.allowed, entry), blocked: without(lists.value.blocked, entry) }, `Removed ${entry}`)
  }

  const isAllowed = (address?: string) => !!address && senderOnList(lists.value.allowed, address)
  const isBlocked = (address?: string) => !!address && senderOnList(lists.value.blocked, address)

  return { lists, refresh, save, allow, block, remove, isAllowed, isBlocked }
}

export const useSenders = createAppComposable(_useSenders)

/** Same matching as the server: an address, or @domain and its subdomains */
export function senderOnList(list: string[], address: string) {
  const email = address.toLowerCase()
  const domain = email.slice(email.indexOf('@') + 1)
  return list.some(entry => entry.startsWith('@') ? domain === entry.slice(1) || domain.endsWith(`.${entry.slice(1)}`) : entry === email)
}
