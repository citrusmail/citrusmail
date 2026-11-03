<script setup lang="ts">
// A few lines on what the message wants, written in as they arrive
const props = defineProps<{
  message: MessageDetail
}>()

const emit = defineEmits<{
  close: []
}>()

const { stream, providerLabel } = useAi()
const text = ref('')
const state = ref<'writing' | 'done' | 'error'>('writing')
const error = ref('')
let controller: AbortController | undefined

async function run() {
  controller?.abort()
  controller = new AbortController()
  text.value = ''
  state.value = 'writing'
  try {
    await stream('/api/ai/summarize', { folder: props.message.folder, id: props.message.id }, sofar => (text.value = sofar), controller.signal)
    state.value = 'done'
  } catch (failure) {
    if ((failure as Error).name === 'AbortError') return
    error.value = (failure as Error).message
    state.value = 'error'
  }
}

onBeforeUnmount(() => controller?.abort())
defineExpose({ run })

// A line starting with "!" is what the reader needs to do, in any language
const lines = computed(() => text.value.split('\n')
  .map(line => line.replace(/^\s*[-•*]\s*/, '').trim())
  .filter(Boolean)
  .map(line => ({ text: line.replace(/^!\s*/, ''), action: line.startsWith('!') })))
</script>

<template>
  <section
    class="relative rounded-lg bg-(--lb-ai-bg) ring ring-[color-mix(in_oklab,var(--lb-ai)_22%,transparent)] px-4 py-3"
    aria-label="Summary"
    :aria-busy="state === 'writing'"
  >
    <header class="flex items-center gap-2 mb-1.5">
      <UIcon
        name="i-lucide-sparkles"
        class="size-4 text-(--lb-ai)"
        :class="state === 'writing' && 'animate-pulse'"
      />
      <h2 class="text-sm font-semibold text-highlighted">
        Summary
      </h2>
      <span class="text-xs text-muted">{{ providerLabel }}</span>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Close summary"
        class="ms-auto -me-2"
        @click="emit('close')"
      />
    </header>
    <p
      v-if="state === 'error'"
      class="text-sm text-error"
    >
      {{ error }}
    </p>
    <ul
      v-else
      class="flex flex-col gap-1 text-sm text-default leading-relaxed"
    >
      <li
        v-for="(line, index) in lines"
        :key="index"
        class="flex gap-2"
        :class="line.action && 'font-medium text-highlighted'"
      >
        <UIcon
          v-if="line.action"
          name="i-lucide-circle-arrow-right"
          class="mt-1 size-3.5 text-(--lb-ai) shrink-0"
        />
        <span
          v-else
          class="mt-2 size-1 rounded-full bg-(--lb-ai) shrink-0"
        />
        <span>{{ line.text }}</span>
      </li>
      <li
        v-if="state === 'writing' && !lines.length"
        class="text-muted"
      >
        Reading<span class="lb-ai-dots" />
      </li>
    </ul>
  </section>
</template>
