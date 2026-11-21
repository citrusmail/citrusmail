type Keys = Exclude<Parameters<typeof defineShortcuts>[0], Ref>

// These stay when one-key shortcuts are switched off (Settings → Reading):
// anything held with ⌘ or Ctrl, and the keys every list answers to
const ALWAYS = /^(meta|ctrl)_|(^|_)(arrow(up|down|left|right)|delete|backspace|enter|escape|tab)$/

/** Whether one-key shortcuts (c to write, e to archive…) are on, and the switch for them */
export function useOneKeyShortcuts() {
  const { settings, save } = useSettings()
  return computed({
    get: () => settings.value.shortcuts !== false,
    set: (value: boolean) => { save({ shortcuts: value }, value ? 'Keyboard shortcuts are on' : 'Keyboard shortcuts are off') }
  })
}

/**
 * Each one-key shortcut's own switch (utils/shortcuts.ts lists them). All on
 * until one is switched off; the master switch above still rules them all
 */
export function useShortcutSwitches() {
  const { settings, save } = useSettings()
  const all = useOneKeyShortcuts()
  const off = computed(() => new Set(settings.value.shortcutsOff ?? []))
  const isOn = (id?: string) => !id || (all.value && !off.value.has(id))
  /** Saved quietly: the switch itself shows what happened */
  const set = (id: string, on: boolean) => save({ shortcutsOff: withShortcut(settings.value.shortcutsOff, id, on) }, false)
  return { all, isOn, set }
}

/**
 * `defineShortcuts`, without the one-key shortcuts the person has switched
 * off (all of them, or one by one), so a stray key in the wrong place does
 * nothing
 */
export function defineKeys(keys: Keys) {
  const oneKey = useOneKeyShortcuts()
  const { settings } = useSettings()
  const dropped = computed(() => bindsOff(settings.value.shortcutsOff))
  return defineShortcuts(computed(() => Object.fromEntries(Object.entries(keys).filter(([key]) =>
    ALWAYS.test(key) || (oneKey.value && !dropped.value.has(key))))))
}
