// State the app shell shares across sections: the sidebar (expanded or
// folded to icons on desktop, a slideover below `lg`), which section is on
// screen, and where each one was last left so going back lands there
const _useShell = () => {
  const route = useRoute()
  const { user } = useUserSession()
  const isMobile = useMediaQuery('(max-width: 1023px)')

  // Folding the sidebar is remembered in this browser, apart from the phone slideover
  const folded = useLocalStorage('citrusmail-sidebar-folded', false)
  const isSidebarOpen = ref(isMobile.value ? false : !folded.value)
  watch(isSidebarOpen, (open) => {
    if (!isMobile.value) folded.value = !open
  })
  const isCollapsed = computed(() => !isMobile.value && !isSidebarOpen.value)

  function toggleSidebar() {
    isSidebarOpen.value = !isSidebarOpen.value
  }

  const section = computed<Section>(() => sectionOf(route.path))

  const account = computed(() => user.value as SessionAccount | null)

  const lastPaths = useState<Record<Section, string>>('section-paths', () => ({
    mail: '/mail/INBOX',
    calendar: `/calendar/week/${todayDate().toString()}`,
    contacts: '/contacts',
    settings: '/settings'
  }))
  watch(() => route.fullPath, (path) => {
    lastPaths.value[sectionOf(route.path)] = path
  }, { immediate: true })

  return { isSidebarOpen, isCollapsed, isMobile, toggleSidebar, section, account, lastPaths }
}

export const useShell = createAppComposable(_useShell)
