<script setup lang="ts">
// The page beside the sidebar, moving with the same slide (useSectionSlide).
// As a swipe or a click takes the sidebar towards the next section, the
// page you're leaving drifts the same way and fades, in step with the
// fingers; once the slide lands and the next page opens, it comes in from
// the other side. Turn back before the end, and the page you were on fades
// back in. Nothing moves with reduced motion.
//
// It stacks on its own (`isolate`): pages that sit a layer down (Calendar
// is `-z-1`) would otherwise fall beneath it and never get a click
const DRIFT = 24
/** Gone completely by this much of the way */
const GONE = 0.85

const { section } = useShell()
const { position } = useSectionSlide()
const reduceMotion = usePreferredReducedMotion()
const stage = useTemplateRef<HTMLElement>('stage')

// How far the slide is from this page's section: 0 on it, 1 a whole section on
const offset = computed(() => {
  const index = SWIPE_SECTIONS.indexOf(section.value)
  return index === -1 ? 0 : position.value - index
})

const style = computed(() => {
  const o = offset.value
  if (Math.abs(o) < 0.001 || reduceMotion.value === 'reduce') return undefined
  const away = Math.min(1, Math.abs(o) / GONE)
  return {
    opacity: 1 - away * away * (3 - 2 * away),
    transform: `translateX(${-o * DRIFT}px)`
  }
})

watch(section, (now, before) => {
  const to = SWIPE_SECTIONS.indexOf(now)
  const from = SWIPE_SECTIONS.indexOf(before)
  if (to === -1 || from === -1 || !stage.value || reduceMotion.value === 'reduce') return
  stage.value.animate(
    [{ opacity: 0, transform: `translateX(${Math.sign(to - from) * DRIFT}px)` }, { opacity: 1, transform: 'none' }],
    { duration: 240, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
  )
}, { flush: 'post' })
</script>

<template>
  <div
    ref="stage"
    class="isolate relative flex-1 min-w-0 flex"
    :style="style"
  >
    <slot />
  </div>
</template>
