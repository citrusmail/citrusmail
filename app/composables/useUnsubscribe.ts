// Leaving a mailing list from one of its messages. One-click and email
// unsubscribes happen on the server; a plain link opens the sender's page
export function useUnsubscribe() {
  const toast = useToast()
  const busy = ref(false)

  async function unsubscribe(source: { folder: string, id: string }, sender?: string): Promise<boolean> {
    busy.value = true
    try {
      const result = await $fetch<UnsubscribeResult>('/api/unsubscribe', { method: 'POST', body: source })
      if (result.done) {
        toast.add({
          title: sender ? `Unsubscribed from ${sender}` : 'Unsubscribed',
          description: result.method === 'email' ? 'The unsubscribe email went to the list. It can take a few days to stop.' : 'It can take a day or two for their mail to stop.',
          icon: 'i-lucide-mail-x',
          color: 'success'
        })
        return true
      }
      if (result.url) {
        window.open(result.url, '_blank', 'noopener,noreferrer')
        toast.add({ title: 'Finish on their page', description: 'This sender only unsubscribes on their own website, now open in a new tab.', icon: 'i-lucide-external-link' })
      }
      return false
    } catch (error) {
      const description = (error as { data?: { message?: string } }).data?.message
      toast.add({ title: 'Couldn’t unsubscribe', description, color: 'error', icon: 'i-lucide-circle-alert' })
      return false
    } finally {
      busy.value = false
    }
  }

  return { busy, unsubscribe }
}

export const UNSUBSCRIBE_HINT: Record<UnsubscribeMethod, string> = {
  'one-click': 'Unsubscribes right here',
  'email': 'Sends the list an unsubscribe email',
  'link': 'Opens the sender’s unsubscribe page'
}
