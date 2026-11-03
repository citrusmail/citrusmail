export type Section = 'mail' | 'calendar' | 'contacts' | 'settings'

// State the app shell shares across sections: the sidebar (expanded or
// folded to icons on desktop, a slideover below `lg`) and which section is on screen
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

  const section = computed<Section>(() => {
    if (route.path.startsWith('/calendar')) return 'calendar'
    if (route.path.startsWith('/contacts')) return 'contacts'
    if (route.path.startsWith('/settings')) return 'settings'
    return 'mail'
  })

  const account = computed(() => user.value as SessionAccount | null)

  return { isSidebarOpen, isCollapsed, isMobile, toggleSidebar, section, account }
}

export const useShell = createAppComposable(_useShell)
