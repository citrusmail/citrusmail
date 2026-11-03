<script setup lang="ts">
// Mail, Calendar and Contacts. The open section shows its name; the others
// are icons, so all three fit the sidebar without being cut off. Folded,
// the same switch stands upright. One pill slides under the open tab, so a
// switch reads as a single movement instead of two tabs fading in and out
const props = defineProps<{
  collapsed?: boolean
}>()

const { section } = useShell()
const route = useRoute()

const lastMailPath = useState('last-mail-path', () => '/mail/INBOX')
watch(() => route.fullPath, (path) => {
  if (path.startsWith('/mail') || path.startsWith('/subscriptions')) lastMailPath.value = path
}, { immediate: true })

const tabs = computed(() => [
  { label: 'Mail', value: 'mail', icon: 'i-lucide-mail', to: lastMailPath.value },
  { label: 'Calendar', value: 'calendar', icon: 'i-lucide-calendar', to: `/calendar/week/${todayDate().toString()}` },
  { label: 'Contacts', value: 'contacts', icon: 'i-lucide-book-user', to: '/contacts' }
])

// The tab moves as soon as it's clicked, not once the next page has loaded
const pending = ref<string>()
watch([section, () => route.fullPath], () => (pending.value = undefined))
const active = computed(() => tabs.value.findIndex(tab => tab.value === (pending.value ?? section.value)))

// The open tab's column is three times as wide as the others, so the pill
// is always three columns wide and only ever slides
const columns = computed(() => tabs.value.map((_, i) => i === active.value ? '3fr' : '1fr').join(' '))

// Navigating renders the next page, which holds up the main thread. Two frames
// first let the motion start on the compositor, where that can't stall it
function go(event: MouseEvent, tab: { value: string, to: string }) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return
  event.preventDefault()
  pending.value = tab.value
  requestAnimationFrame(() => requestAnimationFrame(() => navigateTo(tab.to)))
}

const nav = useTemplateRef<HTMLElement>('nav')
const { leaving } = useSectionTabsMotion(nav, active)
const motion = { transitionDuration: `${SECTION_TABS_MS}ms`, transitionTimingFunction: SECTION_TABS_EASE }
</script>

<template>
  <!-- In the desktop app the sidebar header is where the window is dragged
       from; the switch opts out, or clicks on it would only move the window -->
  <nav
    ref="nav"
    aria-label="Sections"
    class="relative gap-1 p-1 rounded-[calc(var(--ui-radius)*2)] bg-(--lb-tab-track) ring ring-inset ring-(--lb-tab-ring) [-webkit-app-region:no-drag]"
    :class="props.collapsed ? 'flex flex-col self-center' : 'w-full grid grid-cols-(--lb-tab-cols)'"
    :style="{ '--lb-tab-cols': columns, '--lb-tab-i': Math.max(active, 0) }"
  >
    <!-- Three of five columns wide; each step is one column (a third of the pill) plus a gap -->
    <span
      aria-hidden="true"
      class="absolute top-1 left-1 h-8 rounded-[calc(var(--ui-radius)*1.5)] bg-(--lb-tab-active) shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_var(--lb-tab-ring)] dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),0_0_0_1px_var(--lb-tab-ring)] transition-[translate,opacity] will-change-transform motion-reduce:transition-none"
      :class="[
        props.collapsed ? 'w-8 translate-y-[calc(var(--lb-tab-i)*2.25rem)]' : 'w-[calc((100%-1rem)/5*3)] translate-x-[calc(var(--lb-tab-i)*(100%/3+0.25rem))]',
        active < 0 && 'opacity-0'
      ]"
      :style="motion"
    />
    <UTooltip
      v-for="(tab, i) in tabs"
      :key="tab.value"
      :text="tab.label"
      :disabled="i === active && !props.collapsed"
      :content="{ side: props.collapsed ? 'right' : 'bottom' }"
    >
      <NuxtLink
        :to="tab.to"
        :aria-label="tab.label"
        :aria-current="i === active ? 'page' : undefined"
        class="relative flex items-center justify-center min-w-0 h-8 rounded-[calc(var(--ui-radius)*1.5)] text-[13px] font-semibold transition-colors duration-200 motion-reduce:transition-none outline-primary focus-visible:outline-2"
        :class="[
          i === active ? 'text-highlighted' : 'text-muted hover:text-default hover:bg-(--lb-tab-active)/50',
          props.collapsed ? 'w-8' : 'px-2'
        ]"
        @click.capture="go($event, tab)"
      >
        <span
          data-flip
          class="relative flex items-center will-change-transform"
        >
          <UIcon
            :name="tab.icon"
            class="size-4 shrink-0"
          />
          <!-- The open tab's name; the one just left keeps its name, out of
               the layout, while it wipes away -->
          <span
            v-if="!props.collapsed && (i === active || i === leaving)"
            data-label
            :data-leaving="i !== active || undefined"
            class="ms-1.5 whitespace-nowrap pointer-events-none"
            :class="i !== active && 'absolute left-full'"
          >{{ tab.label }}</span>
        </span>
      </NuxtLink>
    </UTooltip>
  </nav>
</template>
