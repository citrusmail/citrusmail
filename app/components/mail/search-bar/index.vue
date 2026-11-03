<script setup lang="ts">
// Search this folder as you type, or (with an AI key) ask a question of all
// your mail and press Enter
const { folder, search, status, filtering, ai, askAi, exitAi } = useMail()
const { ready } = useAi()

const searchInput = useTemplateRef('searchInput')
const question = ref('')
const asking = computed(() => ai.value.on)

const model = computed({
  get: () => asking.value ? question.value : search.value,
  set: (value: string) => {
    if (asking.value) question.value = value
    else search.value = value
  }
})

function toggleAi() {
  if (asking.value) {
    exitAi()
  } else {
    // What was typed carries over as the question
    question.value = search.value
    search.value = ''
    ai.value = { on: true, status: 'idle', query: '' }
  }
  nextTick(() => searchInput.value?.inputRef?.focus())
}

function onEnter() {
  if (asking.value) askAi(question.value)
}

function onEscape(event: KeyboardEvent) {
  if (asking.value) exitAi()
  else search.value = ''
  ;(event.target as HTMLInputElement).blur()
}

defineShortcuts({
  '/': () => searchInput.value?.inputRef?.focus()
})
</script>

<template>
  <div
    class="shrink-0 border-b border-default transition-colors"
    :class="asking && 'bg-(--lb-ai-bg)'"
  >
    <UInput
      ref="searchInput"
      v-model="model"
      :icon="asking ? 'i-lucide-sparkles' : 'i-lucide-search'"
      :placeholder="asking ? 'Ask about any message, then press Enter' : `Search ${folder?.name ?? 'mail'}`"
      variant="none"
      size="lg"
      :loading="asking ? ai.status === 'loading' : status === 'loading' && (!!search || filtering)"
      :ui="{ base: 'ps-11 pe-24 h-11', leading: 'ps-4', leadingIcon: asking ? 'text-(--lb-ai)' : '', trailing: 'pe-2 gap-1' }"
      @keydown.enter="onEnter"
      @keydown.escape="onEscape"
    >
      <template #trailing>
        <UButton
          v-if="model"
          icon="i-lucide-x"
          color="neutral"
          variant="link"
          size="xs"
          aria-label="Clear search"
          @click="model = ''"
        />
        <UKbd
          v-else-if="!asking"
          value="/"
          variant="soft"
          class="hidden lg:inline-flex"
        />
        <UTooltip
          v-if="ready"
          :text="asking ? 'Back to searching this folder' : 'Ask AI about all your mail'"
        >
          <UButton
            icon="i-lucide-sparkles"
            :color="asking ? 'primary' : 'neutral'"
            :variant="asking ? 'soft' : 'ghost'"
            size="xs"
            :aria-pressed="asking"
            aria-label="Ask AI about all your mail"
            :class="asking && 'text-(--lb-ai) bg-[color-mix(in_oklab,var(--lb-ai)_14%,transparent)]'"
            @click="toggleAi"
          />
        </UTooltip>
        <MailSearchFilters v-if="!asking" />
      </template>
    </UInput>

    <MailSearchChips v-if="!asking" />
  </div>
</template>
