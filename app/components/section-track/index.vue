<script setup lang="ts">
// Mail, Calendar and Contacts' sidebars side by side on one strip that slides
// with useSectionSlide, so a swipe shows the next one coming in beside this
// one. Only the section on screen can be reached by keyboard or pointer
const { section } = useShell()
const { position, width, heading } = useSectionSlide()

const viewport = useTemplateRef('viewport')
const { width: measured } = useElementSize(viewport)
watch(measured, (value) => {
  if (value) width.value = value
})

// The neighbours mount once the app has a moment, so the first swipe
// doesn't wait on them rendering
const mounted = ref(new Set<Section>([section.value]))
watch(heading, value => mounted.value.add(value))
onNuxtReady(() => {
  const all = () => (mounted.value = new Set(SWIPE_SECTIONS))
  if ('requestIdleCallback' in window) requestIdleCallback(all, { timeout: 2000 })
  else setTimeout(all, 500)
})
</script>

<template>
  <!-- Clipped at the sidebar's edges, both ways: each panel scrolls on its own,
       so nothing in the strip can make the whole sidebar scroll -->
  <div
    ref="viewport"
    class="relative flex-1 min-h-0 -mx-3 overflow-clip"
  >
    <div
      class="absolute inset-y-0 start-0 flex w-[300%] will-change-transform"
      :style="{ transform: `translateX(${-position * (100 / 3)}%)` }"
    >
      <div
        v-for="item in SWIPE_SECTIONS"
        :key="item"
        class="w-1/3 h-full overflow-y-auto px-3 flex flex-col gap-3"
        :inert="item !== heading || undefined"
        :aria-hidden="item !== heading || undefined"
      >
        <template v-if="mounted.has(item)">
          <MailSidebar v-if="item === 'mail'" />
          <CalendarSidebar v-else-if="item === 'calendar'" />
          <ContactsSidebar v-else />
        </template>
      </div>
    </div>
  </div>
</template>
