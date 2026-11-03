<script setup lang="ts">
defineProps<{
  background: BackgroundSettings
}>()

const emit = defineEmits<{
  adjust: [patch: Partial<BackgroundSettings>]
  reset: []
}>()

const FILTERS: { label: string, value: BackgroundSettings['filter'] }[] = [
  { label: 'Natural', value: 'none' },
  { label: 'Warm', value: 'warm' },
  { label: 'Cool', value: 'cool' },
  { label: 'Sepia', value: 'sepia' },
  { label: 'Mono', value: 'mono' }
]
const SLIDERS = [
  { key: 'blur', label: 'Blur', min: 0, max: 24, unit: 'px' },
  { key: 'brightness', label: 'Brightness', min: 40, max: 140, unit: '%' },
  { key: 'saturation', label: 'Color', min: 0, max: 200, unit: '%' }
] as const
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-wrap gap-2">
      <UButton
        v-for="filter in FILTERS"
        :key="filter.value"
        :label="filter.label"
        :color="background.filter === filter.value ? 'primary' : 'neutral'"
        :variant="background.filter === filter.value ? 'soft' : 'outline'"
        size="sm"
        :aria-pressed="background.filter === filter.value"
        @click="emit('adjust', { filter: filter.value })"
      />
    </div>
    <div class="grid gap-4 max-w-md">
      <UFormField
        v-for="slider in SLIDERS"
        :key="slider.key"
        :label="slider.label"
        :hint="`${background[slider.key]}${slider.unit}`"
      >
        <USlider
          :model-value="background[slider.key]"
          :min="slider.min"
          :max="slider.max"
          class="mt-2"
          @update:model-value="emit('adjust', { [slider.key]: $event as number })"
        />
      </UFormField>
    </div>
    <UButton
      label="Reset adjustments"
      color="neutral"
      variant="link"
      size="sm"
      class="self-start px-0"
      @click="emit('reset')"
    />
  </div>
</template>
