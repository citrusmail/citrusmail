<script setup lang="ts">
// One line about the message's language: offered when it's foreign to you,
// then what's happening, then a way back to the original
const props = defineProps<{
  translation: ReturnType<typeof useMessageTranslation>
}>()

const { ready, providerLabel } = useAi()
const t = props.translation
const { state, from, detected, foreign, error, target } = t

const source = computed(() => languageName(from.value ?? detected.value))
const shown = computed(() => ready.value && (state.value !== 'idle' || foreign.value))

const line = computed(() => {
  if (state.value === 'translating') return `Translating${from.value ? ` from ${languageName(from.value)}` : ''} into ${languageName(target.value)}`
  if (state.value === 'translated') return `Translated from ${source.value}`
  if (state.value === 'original') return `Showing the original in ${source.value}`
  if (state.value === 'error') return error.value
  return `Written in ${source.value}`
})
</script>

<template>
  <Transition name="lb-summary">
    <div
      v-if="shown"
      class="flex items-center gap-2 min-h-9 ps-3 pe-1 rounded-lg ring text-sm transition-colors"
      :class="state === 'error' ? 'ring-error/30 bg-error/5' : 'ring-[color-mix(in_oklab,var(--ui-primary)_22%,transparent)] bg-[color-mix(in_oklab,var(--ui-primary)_6%,transparent)]'"
      role="status"
    >
      <UIcon
        :name="state === 'error' ? 'i-lucide-circle-alert' : 'i-lucide-languages'"
        class="size-4 shrink-0"
        :class="[state === 'error' ? 'text-error' : 'text-primary', state === 'translating' && 'animate-pulse']"
      />
      <p class="flex-1 min-w-0 truncate text-toned">
        {{ line }}<span
          v-if="state === 'translating'"
          class="lb-ai-dots"
        />
        <span
          v-if="state === 'translated' && providerLabel"
          class="text-dimmed"
        > with {{ providerLabel }}</span>
      </p>
      <UButton
        v-if="state === 'translating'"
        label="Stop"
        color="neutral"
        variant="ghost"
        size="xs"
        @click="t.stop()"
      />
      <UButton
        v-else-if="state === 'translated'"
        label="Show original"
        color="neutral"
        variant="ghost"
        size="xs"
        @click="t.showOriginal()"
      />
      <UButton
        v-else
        :label="state === 'original' ? `Show in ${languageName(target)}` : state === 'error' ? 'Try again' : `Translate to ${languageName(target)}`"
        :icon="state === 'error' ? 'i-lucide-rotate-cw' : undefined"
        color="primary"
        variant="soft"
        size="xs"
        @click="t.run()"
      />
    </div>
  </Transition>
</template>
