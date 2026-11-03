<script setup lang="ts">
// Offered on a reply to a message you read translated
const { draft } = useComposer()
const { translating, translated, run, undo } = useReplyTranslation()
const language = computed(() => languageName(draft.value.translateTo))
</script>

<template>
  <div
    class="flex items-center gap-2 px-5 min-h-10 border-b border-default bg-[color-mix(in_oklab,var(--ui-primary)_5%,transparent)] text-sm"
    role="status"
  >
    <UIcon
      name="i-lucide-languages"
      class="size-4 shrink-0 text-primary"
      :class="translating && 'animate-pulse'"
    />
    <p class="flex-1 min-w-0 truncate text-toned">
      <template v-if="translating">
        Translating your reply into {{ language }}<span class="lb-ai-dots" />
      </template>
      <template v-else-if="translated">
        Your reply is now in {{ language }}
      </template>
      <template v-else>
        You read this in translation. They wrote in {{ language }}.
      </template>
    </p>
    <UButton
      v-if="translated || translating"
      :label="translating ? 'Stop' : 'Undo'"
      :icon="translating ? undefined : 'i-lucide-undo-2'"
      color="neutral"
      variant="ghost"
      size="xs"
      @click="undo"
    />
    <UButton
      v-else
      :label="`Translate my reply to ${language}`"
      color="primary"
      variant="soft"
      size="xs"
      @click="run"
    />
  </div>
</template>
