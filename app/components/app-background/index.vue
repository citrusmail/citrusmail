<script setup lang="ts">
// Your picture behind the desk, with the filters from Settings → Appearance.
// It sits under everything, so the sidebar shows it through a tinted glass and
// the sheet you read on stays opaque
const props = defineProps<{
  /** Settings preview: shown in place of the saved values while editing */
  preview?: BackgroundSettings
}>()

const { settings } = useSettings()
const background = computed(() => props.preview ?? settings.value.appearance?.background)

const FILTERS: Record<BackgroundSettings['filter'], string> = {
  none: '',
  mono: 'grayscale(1)',
  sepia: 'sepia(0.65)',
  warm: 'sepia(0.25) saturate(1.15) hue-rotate(-8deg)',
  cool: 'hue-rotate(12deg) saturate(0.85) brightness(1.02)'
}

const style = computed(() => {
  const value = background.value
  if (!value) return undefined
  return {
    filter: [`blur(${value.blur}px)`, `brightness(${value.brightness}%)`, `saturate(${value.saturation}%)`, FILTERS[value.filter]].filter(Boolean).join(' '),
    // A blur pulls the edges in; a little scale keeps them off screen
    transform: value.blur ? `scale(${1 + value.blur / 200})` : undefined
  }
})

const src = computed(() => background.value ? `/api/background?v=${background.value.version}` : '')
const loaded = ref(false)
watch(src, () => (loaded.value = false))

if (!props.preview) {
  watchEffect(() => {
    document.documentElement.classList.toggle('lb-has-background', Boolean(src.value && loaded.value))
  })
  onBeforeUnmount(() => document.documentElement.classList.remove('lb-has-background'))
}
</script>

<template>
  <div
    v-if="src"
    class="pointer-events-none overflow-hidden"
    :class="preview ? 'absolute inset-0' : 'fixed inset-0 -z-10'"
    aria-hidden="true"
  >
    <img
      :src="src"
      alt=""
      class="size-full object-cover transition-opacity duration-500 motion-reduce:transition-none"
      :class="loaded ? 'opacity-100' : 'opacity-0'"
      :style="style"
      @load="loaded = true"
    >
    <!-- The desk's tint, one even layer over the picture everywhere outside the sheet -->
    <div
      v-if="!preview"
      class="absolute inset-0 bg-(--lb-desk)"
    />
  </div>
</template>
