const _useShortcutsHelp = () => {
  const isOpen = ref(false)

  defineShortcuts({
    '?': () => (isOpen.value = !isOpen.value)
  })

  return { isOpen, open: () => (isOpen.value = true) }
}

export const useShortcutsHelp = createAppComposable(_useShortcutsHelp)

export const SHORTCUT_GROUPS = [{
  title: 'Mail',
  items: [
    { label: 'New message', keys: ['c'] },
    { label: 'Next / previous message', keys: ['j', 'k'] },
    { label: 'Reply', keys: ['r'] },
    { label: 'Reply all', keys: ['a'] },
    { label: 'Forward', keys: ['f'] },
    { label: 'Archive', keys: ['e'] },
    { label: 'Delete', keys: ['#'] },
    { label: 'Flag', keys: ['s'] },
    { label: 'Mark unread', keys: ['shift', 'u'] },
    { label: 'Send', keys: ['meta', 'enter'] },
    { label: 'Search', keys: ['/'] }
  ]
}, {
  title: 'Calendar',
  items: [
    { label: 'Day, week, month, year', keys: ['d', 'w', 'm', 'y'] },
    { label: 'Today', keys: ['t'] },
    { label: 'Previous / next', keys: ['arrowleft', 'arrowright'] },
    { label: 'New event', keys: ['n'] },
    { label: 'Search events', keys: ['meta', 'k'] }
  ]
}]
