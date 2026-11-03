// Which messages you've translated, and from what, so a message opens
// translated again and a reply to it can go back in the sender's language
interface Remembered { from: string, to: string, at: number }
const LIMIT = 300

export function useTranslationMemory() {
  const { account } = useShell()
  const memory = useLocalStorage<Record<string, Remembered>>('citrusmail-translated', {})
  const keyOf = (message: { folder: string, id: string }) => `${account.value?.email ?? ''}|${message.folder}|${message.id}`

  function remember(message: { folder: string, id: string }, from: string, to: string) {
    // Newest first, and only the latest few hundred
    const entries = Object.entries({ ...memory.value, [keyOf(message)]: { from, to, at: Date.now() } })
    memory.value = Object.fromEntries(entries.sort((a, b) => b[1].at - a[1].at).slice(0, LIMIT))
  }

  function forget(message: { folder: string, id: string }) {
    const key = keyOf(message)
    memory.value = Object.fromEntries(Object.entries(memory.value).filter(([entry]) => entry !== key))
  }

  const recall = (message: { folder: string, id: string }) => memory.value[keyOf(message)]

  return { remember, forget, recall }
}
