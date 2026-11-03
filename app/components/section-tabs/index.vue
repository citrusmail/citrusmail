<script setup lang="ts">
// Mail, Calendar and Contacts. The open section shows its name; the others
// are icons, so all three fit the sidebar without being cut off. Folded,
// the same switch stands upright
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
const isActive = (value: string) => (pending.value ?? section.value) === value

// The open section's column is three times as wide as the others. Columns in
// fr units animate smoothly from one tab to the next, as widths in px and
// "auto" can't
const columns = computed(() => tabs.value.map(tab => isActive(tab.value) ? '3fr' : '1fr').join(' '))
</script>

<template>
  <nav
    aria-label="Sections"
    class="gap-1 p-1 rounded-[calc(var(--ui-radius)*2)] bg-(--lb-tab-track) ring ring-inset ring-(--lb-tab-ring)"
    :class="props.collapsed ? 'flex flex-col self-center' : 'w-full grid grid-cols-(--lb-tab-cols) transition-[grid-template-columns] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none'"
    :style="{ '--lb-tab-cols': columns }"
  >
    <UTooltip
      v-for="tab in tabs"
      :key="tab.value"
      :text="tab.label"
      :disabled="isActive(tab.value) && !props.collapsed"
      :content="{ side: props.collapsed ? 'right' : 'bottom' }"
    >
      <NuxtLink
        :to="tab.to"
        :aria-label="tab.label"
        :aria-current="isActive(tab.value) ? 'page' : undefined"
        class="flex items-center justify-center min-w-0 h-8 overflow-hidden rounded-[calc(var(--ui-radius)*1.5)] text-[13px] font-semibold transition-[background-color,color,box-shadow] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none outline-primary focus-visible:outline-2"
        :class="[
          isActive(tab.value)
            ? 'text-highlighted bg-(--lb-tab-active) shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_var(--lb-tab-ring)] dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),0_0_0_1px_var(--lb-tab-ring)]'
            : 'text-muted bg-transparent shadow-[0_0_0_0_transparent,0_0_0_0_transparent] hover:text-default hover:bg-(--lb-tab-active)/50',
          props.collapsed ? 'w-8' : 'px-2'
        ]"
        @click="pending = tab.value"
      >
        <UIcon
          :name="tab.icon"
          class="size-4 shrink-0"
        />
        <span
          v-if="!props.collapsed"
          class="overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none"
          :class="isActive(tab.value) ? 'max-w-24 opacity-100 ms-1.5 delay-75' : 'max-w-0 opacity-0'"
        >{{ tab.label }}</span>
      </NuxtLink>
    </UTooltip>
  </nav>
</template>
