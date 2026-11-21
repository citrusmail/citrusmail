<script setup lang="ts">
// Mail, Calendar and Contacts. The open section shows its name; the others
// are icons, so all three fit the sidebar without being cut off. Folded, the
// same switch stands upright. Everything here is drawn from the slide's
// position (useSectionSlide), never animated on its own: a click, a drag and
// a flick move the pill, the widths and the names in step with the sidebar
const props = defineProps<{
  collapsed?: boolean
}>()

const { section, lastPaths } = useShell()
const { position, goTo } = useSectionSlide()

const tabs = computed(() => [
  { label: 'Mail', value: 'mail' as const, icon: 'i-lucide-mail', to: lastPaths.value.mail },
  { label: 'Calendar', value: 'calendar' as const, icon: 'i-lucide-calendar', to: lastPaths.value.calendar },
  { label: 'Contacts', value: 'contacts' as const, icon: 'i-lucide-book-user', to: lastPaths.value.contacts }
])

// How open each tab is: 1 under the pill, 0 a whole step away
const weights = computed(() => tabs.value.map((_, i) => Math.max(0, 1 - Math.abs(position.value - i))))
// The open tab's column is three times as wide as the others, so the pill is
// always three columns wide and only ever slides
const columns = computed(() => weights.value.map(w => `${1 + 2 * w}fr`).join(' '))
const nearest = computed(() => Math.round(position.value))
// In Settings no tab is open until one is chosen
const onSections = computed(() => SWIPE_SECTIONS.includes(section.value))

// Each name is uncovered as its tab opens, so it needs its full width to hand
const names = useTemplateRef<HTMLElement[]>('names')
const nameWidths = ref<number[]>([])
const measure = () => {
  nameWidths.value = (names.value ?? []).map(el => el.offsetWidth)
}
// The names come and go with the folded sidebar, and fonts can land after
// the first measure, so measure again whenever any of that changes
useResizeObserver(() => names.value ?? [], measure)
watch(() => props.collapsed, () => nextTick(measure))
onMounted(() => document.fonts?.ready.then(measure))

function nameStyle(i: number) {
  const w = weights.value[i] ?? 0
  const measured = nameWidths.value[i]
  // At rest the open tab sizes itself, so its name can never be squeezed
  // to nothing by a missed measure; mid-slide it follows the measure
  const width = w >= 1 || (w > 0 && !measured) ? 'auto' : `${w * (measured ?? 0)}px`
  return {
    width,
    marginInlineStart: `${w * 6}px`,
    opacity: Math.min(1, w * 1.6 - 0.3)
  }
}

function go(event: MouseEvent, tab: { value: Section }) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return
  event.preventDefault()
  goTo(tab.value)
}
</script>

<template>
  <!-- In the desktop app the sidebar header is where the window is dragged
       from; the switch opts out, or clicks on it would only move the window -->
  <nav
    aria-label="Sections"
    class="relative gap-1 [-webkit-app-region:no-drag]"
    :class="props.collapsed ? 'flex flex-col self-center' : 'w-full grid p-1 rounded-[calc(var(--ui-radius)*2)] bg-(--lb-tab-track) ring ring-inset ring-(--lb-tab-ring)'"
    :style="props.collapsed ? undefined : { gridTemplateColumns: columns }"
  >
    <!-- Three of five columns wide; each step is one column (a third of the pill) plus a gap -->
    <span
      aria-hidden="true"
      class="absolute bg-(--lb-tab-active) shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_var(--lb-tab-ring)] dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),0_0_0_1px_var(--lb-tab-ring)] transition-opacity will-change-transform"
      :class="[props.collapsed ? 'size-9 top-0 left-0 rounded-lg' : 'top-1 left-1 h-8 rounded-[calc(var(--ui-radius)*1.5)] w-[calc((100%-1rem)/5*3)]', !onSections && 'opacity-0']"
      :style="{ transform: props.collapsed ? `translateY(${position * 2.5}rem)` : `translateX(calc(${position} * (100% / 3 + 0.25rem)))` }"
    />
    <UTooltip
      v-for="(tab, i) in tabs"
      :key="tab.value"
      :text="tab.label"
      :disabled="i === nearest && !props.collapsed"
      :content="{ side: props.collapsed ? 'right' : 'bottom' }"
    >
      <NuxtLink
        :to="tab.to"
        :aria-label="tab.label"
        :aria-current="tab.value === section ? 'page' : undefined"
        class="relative flex items-center justify-center min-w-0 text-[13px] font-semibold transition-colors duration-150 motion-reduce:transition-none outline-primary focus-visible:outline-2"
        :class="[
          i === nearest && onSections ? 'text-highlighted' : 'text-muted hover:text-default hover:bg-(--lb-tab-active)/50',
          props.collapsed ? 'size-9 rounded-lg' : 'h-8 px-2 rounded-[calc(var(--ui-radius)*1.5)]'
        ]"
        @click.capture="go($event, tab)"
      >
        <UIcon
          :name="tab.icon"
          class="size-4 shrink-0"
        />
        <span
          v-if="!props.collapsed"
          class="overflow-hidden pointer-events-none"
          :style="nameStyle(i)"
        ><span
          ref="names"
          class="block w-max whitespace-nowrap"
        >{{ tab.label }}</span></span>
      </NuxtLink>
    </UTooltip>
  </nav>
</template>
