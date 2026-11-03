export const LIST_WIDTH = { min: 320, max: 560, default: 400 }

// How the mail page is laid out: the list with the open message beside it
// (split), or the list alone with messages opening over it. The width is
// mirrored in this browser so the first paint is right before settings load
const _useMailLayout = () => {
  const { settings, save } = useSettings()
  const local = useLocalStorage('citrusmail-mail-layout', { view: 'split' as MailView, listWidth: LIST_WIDTH.default })

  watch(() => [settings.value.view, settings.value.listWidth] as const, ([view, width]) => {
    if (view) local.value.view = view
    if (width) local.value.listWidth = width
  }, { immediate: true })

  const view = computed<MailView>({
    get: () => local.value.view,
    set: (value) => {
      local.value.view = value
      save({ view: value }, false)
    }
  })

  const listWidth = computed(() => Math.min(LIST_WIDTH.max, Math.max(LIST_WIDTH.min, local.value.listWidth)))

  function resize(width: number) {
    local.value.listWidth = Math.round(Math.min(LIST_WIDTH.max, Math.max(LIST_WIDTH.min, width)))
  }
  const persistWidth = useDebounceFn(() => save({ listWidth: local.value.listWidth }, false), 600)

  defineShortcuts({ shift_v: () => (view.value = view.value === 'split' ? 'list' : 'split') })

  return { view, listWidth, resize, persistWidth }
}

export const useMailLayout = createAppComposable(_useMailLayout)
