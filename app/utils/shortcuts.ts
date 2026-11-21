/**
 * Every keyboard shortcut the app answers to, as Settings → Reading and the
 * shortcuts sheet list them. `binds` are the names the shortcut is registered
 * under (`defineKeys`): switching a shortcut off drops exactly those.
 * A shortcut with no `id` cannot be switched off: arrows, Delete and anything
 * held with ⌘ or Ctrl work whatever the switches say.
 */
export interface ShortcutItem {
  /** Saved in settings when the shortcut is off; never rename one */
  id?: string
  label: string
  keys: string[]
  binds?: string[]
}

export const SHORTCUT_GROUPS: Array<{ title: string, items: ShortcutItem[] }> = [{
  title: 'Mail',
  items: [
    { id: 'compose', label: 'New message', keys: ['c'], binds: ['c'] },
    { id: 'step', label: 'Next / previous message', keys: ['j', 'k'], binds: ['j', 'k'] },
    { id: 'reply', label: 'Reply', keys: ['r'], binds: ['r'] },
    { id: 'replyAll', label: 'Reply all', keys: ['a'], binds: ['a'] },
    { id: 'forward', label: 'Forward', keys: ['f'], binds: ['f'] },
    { id: 'archive', label: 'Archive', keys: ['e'], binds: ['e'] },
    { id: 'delete', label: 'Delete', keys: ['#'], binds: ['#'] },
    { id: 'flag', label: 'Flag', keys: ['s'], binds: ['s'] },
    { id: 'unread', label: 'Mark unread', keys: ['shift', 'u'], binds: ['shift_u'] },
    { id: 'search', label: 'Search', keys: ['/'], binds: ['/'] },
    { id: 'view', label: 'Switch layout', keys: ['shift', 'v'], binds: ['shift_v'] },
    { id: 'help', label: 'Show shortcuts', keys: ['?'], binds: ['?'] },
    { label: 'Send', keys: ['meta', 'enter'] }
  ]
}, {
  title: 'Calendar',
  items: [
    { id: 'calendarViews', label: 'Day, week, month, year', keys: ['d', 'w', 'm', 'y'], binds: ['d', 'w', 'm', 'y'] },
    { id: 'calendarToday', label: 'Today', keys: ['t'], binds: ['t'] },
    { id: 'calendarNew', label: 'New event', keys: ['n'], binds: ['n'] },
    { label: 'Previous / next', keys: ['arrowleft', 'arrowright'] },
    { label: 'Search events', keys: ['meta', 'k'] }
  ]
}]

const KNOWN_IDS = new Set(SHORTCUT_GROUPS.flatMap(group => group.items.flatMap(item => item.id ? [item.id] : [])))

/** The registered names to drop for the shortcuts switched off (unknown ids are ignored) */
export function bindsOff(off: readonly string[] | undefined): Set<string> {
  const ids = new Set((off ?? []).filter(id => KNOWN_IDS.has(id)))
  return new Set(SHORTCUT_GROUPS.flatMap(group => group.items.flatMap(item => item.id && ids.has(item.id) ? item.binds ?? [] : [])))
}

/** The saved list after switching one shortcut on or off: known ids only, each once */
export function withShortcut(off: readonly string[] | undefined, id: string, on: boolean): string[] {
  const next = new Set((off ?? []).filter(known => KNOWN_IDS.has(known)))
  if (on) next.delete(id)
  else if (KNOWN_IDS.has(id)) next.add(id)
  return [...next]
}
