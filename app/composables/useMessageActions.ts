import type { ContextMenuItem } from '@nuxt/ui'

// The actions a message offers, shared by its right-click menu and anything
// else that lists them
export function useMessageActions(source: () => MessageSummary) {
  const { folder, setUnread, toggleFlag, move, remove } = useMail()

  const items = computed<ContextMenuItem[][]>(() => {
    const message = source()
    const junk = folder.value?.role === 'junk'
    return [[{
      label: message.unread ? 'Mark as read' : 'Mark as unread',
      icon: message.unread ? 'i-lucide-mail-open' : 'i-lucide-mail',
      kbds: ['shift', 'u'],
      onSelect: () => setUnread(message, !message.unread)
    }, {
      label: message.flagged ? 'Remove flag' : 'Flag',
      icon: 'i-lucide-flag',
      kbds: ['s'],
      onSelect: () => toggleFlag(message)
    }], [{
      label: 'Archive',
      icon: 'i-lucide-archive',
      kbds: ['e'],
      disabled: folder.value?.role === 'archive',
      onSelect: () => move(message, 'archive')
    }, {
      label: junk ? 'Not junk' : 'Move to Junk',
      icon: junk ? 'i-lucide-inbox' : 'i-lucide-shield-alert',
      onSelect: () => move(message, junk ? 'inbox' : 'junk')
    }, {
      label: 'Delete',
      icon: 'i-lucide-trash-2',
      kbds: ['#'],
      color: 'error',
      onSelect: () => remove(message)
    }]]
  })

  return { items }
}
