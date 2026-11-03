<script setup lang="ts">
const props = defineProps<{
  summary?: MessageSummary
  message?: MessageDetail
  /** Shows a way back to the list (list view, phones) */
  back?: boolean
  /** Where AI Translate is for this message */
  translation?: 'idle' | 'translating' | 'translated' | 'original' | 'error'
}>()

const emit = defineEmits<{
  summarize: []
  translate: []
}>()

const { selectedId, setUnread, toggleFlag } = useMail()
const { ready } = useAi()

function act(handler: (message: MessageSummary) => void) {
  return () => props.summary && handler(props.summary)
}
</script>

<template>
  <header class="shrink-0 flex items-center gap-1 h-14 px-3 border-b border-default">
    <UTooltip
      text="Back to the list"
      :kbds="['escape']"
    >
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        aria-label="Back to the list"
        :class="!back && 'lg:hidden'"
        @click="selectedId = undefined"
      />
    </UTooltip>

    <MailReaderMoveActions :summary="summary" />

    <div class="ms-auto flex items-center gap-1">
      <MailUnsubscribeButton
        v-if="message?.unsubscribe"
        :message="message"
      />
      <UTooltip
        v-if="ready"
        :text="translation === 'translated' ? 'Show original' : 'Translate'"
      >
        <UButton
          icon="i-lucide-languages"
          color="neutral"
          :variant="translation === 'translated' ? 'soft' : 'ghost'"
          :aria-label="translation === 'translated' ? 'Show the original' : 'Translate this message'"
          :aria-pressed="translation === 'translated'"
          :loading="translation === 'translating'"
          :disabled="!message"
          @click="emit('translate')"
        />
      </UTooltip>
      <UTooltip
        v-if="ready"
        text="Summarize"
      >
        <UButton
          icon="i-lucide-sparkles"
          color="neutral"
          variant="ghost"
          aria-label="Summarize this message"
          :disabled="!message"
          @click="emit('summarize')"
        />
      </UTooltip>
      <UTooltip
        :text="summary?.unread ? 'Mark as read' : 'Mark as unread'"
        :kbds="['shift', 'u']"
      >
        <UButton
          :icon="summary?.unread ? 'i-lucide-mail-open' : 'i-lucide-mail'"
          color="neutral"
          variant="ghost"
          :aria-label="summary?.unread ? 'Mark as read' : 'Mark as unread'"
          :disabled="!summary"
          @click="act(message => setUnread(message, !message.unread))()"
        />
      </UTooltip>
      <UTooltip
        :text="summary?.flagged ? 'Remove flag' : 'Flag'"
        :kbds="['s']"
      >
        <UButton
          :icon="summary?.flagged ? 'i-ph-flag-fill' : 'i-lucide-flag'"
          color="neutral"
          variant="ghost"
          :ui="{ leadingIcon: summary?.flagged ? 'text-(--lb-flag)' : '' }"
          :aria-label="summary?.flagged ? 'Remove flag' : 'Flag'"
          :disabled="!summary"
          @click="act(toggleFlag)()"
        />
      </UTooltip>
      <MailSenderMenu
        v-if="message"
        :message="message"
      />
    </div>
  </header>
</template>
