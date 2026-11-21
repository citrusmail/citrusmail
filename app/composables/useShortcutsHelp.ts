const _useShortcutsHelp = () => {
  const isOpen = ref(false)

  defineKeys({
    '?': () => (isOpen.value = !isOpen.value)
  })

  return { isOpen, open: () => (isOpen.value = true) }
}

export const useShortcutsHelp = createAppComposable(_useShortcutsHelp)
