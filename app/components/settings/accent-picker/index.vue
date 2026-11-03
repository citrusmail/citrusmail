<script setup lang="ts">
// Presets plus any color. `undefined` means the instance's own accent
const model = defineModel<string | undefined>()

const PRESETS = [
  { label: 'Default', value: undefined, swatch: 'var(--color-post-600)' },
  { label: 'Blue', value: '#2563EB', swatch: '#2563EB' },
  { label: 'Violet', value: '#7C3AED', swatch: '#7C3AED' },
  { label: 'Rose', value: '#E11D48', swatch: '#E11D48' },
  { label: 'Orange', value: '#EA580C', swatch: '#EA580C' },
  { label: 'Teal', value: '#0F766E', swatch: '#0F766E' },
  { label: 'Graphite', value: '#3F3F46', swatch: '#3F3F46' }
]

const custom = computed({
  get: () => model.value?.startsWith('#') ? model.value : '#0C7A57',
  set: value => (model.value = value)
})
const isCustom = computed(() => !!model.value && !PRESETS.some(preset => preset.value === model.value))
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UTooltip
      v-for="preset in PRESETS"
      :key="preset.label"
      :text="preset.label"
    >
      <UButton
        color="neutral"
        variant="ghost"
        :aria-label="preset.label"
        :aria-pressed="model === preset.value"
        class="size-9 p-0 justify-center rounded-full ring-2 ring-offset-2 ring-offset-(--ui-bg)"
        :class="model === preset.value ? 'ring-(--ui-border-inverted)' : 'ring-transparent'"
        @click="model = preset.value"
      >
        <span
          class="size-7 rounded-full"
          :style="{ background: preset.swatch }"
        />
      </UButton>
    </UTooltip>

    <UPopover>
      <UButton
        label="Custom"
        icon="i-lucide-pipette"
        color="neutral"
        :variant="isCustom ? 'soft' : 'outline'"
        size="sm"
        class="ms-1"
      />
      <template #content>
        <div class="p-3">
          <UColorPicker v-model="custom" />
        </div>
      </template>
    </UPopover>
  </div>
</template>
