<script setup lang="ts">
// One line per message for the list-only view: who, subject and the start
// of the message, date. Hovering swaps the date for quick actions
const props = defineProps<{
  message: MessageSummary
  selected: boolean
  /** Sent and Drafts show who it went to rather than who it came from */
  sent?: boolean
}>()

const { selectedId } = useMail()
const menu = useMessageActions(() => props.message)

const person = computed(() => props.sent
  ? `To ${props.message.to.map(personName).join(', ') || 'no one yet'}`
  : personName(props.message.from))
</script>

<template>
  <UContextMenu :items="menu.items.value">
    <div
      class="group relative border-b border-default"
      :class="selected && 'shadow-[inset_2px_0_0_var(--lb-selected-edge)]'"
    >
      <UButton
        :data-id="message.id"
        :aria-current="selected || undefined"
        color="neutral"
        variant="ghost"
        block
        class="h-10 items-center justify-start text-start gap-3 ps-2 pe-4 rounded-none font-normal text-sm"
        :class="selected ? 'bg-(--lb-selected) hover:bg-(--lb-selected)' : message.unread ? 'hover:bg-elevated/60' : 'bg-elevated/25 hover:bg-elevated/60'"
        @click="selectedId = message.id"
      >
        <span
          class="size-2 shrink-0 rounded-full"
          :class="message.unread ? 'bg-(--lb-unread)' : 'bg-transparent'"
          :aria-label="message.unread ? 'Unread' : undefined"
        />
        <span
          class="w-44 shrink-0 truncate"
          :class="message.unread ? 'font-semibold text-highlighted' : 'text-toned'"
        >{{ person }}</span>

        <span class="flex-1 min-w-0 truncate">
          <span :class="message.unread ? 'font-semibold text-highlighted' : 'text-default'">{{ message.subject || '(No subject)' }}</span>
          <span
            v-if="message.preview"
            class="text-muted"
          > – {{ message.preview }}</span>
        </span>

        <span class="shrink-0 flex items-center gap-1.5 text-xs text-muted tabular-nums group-hover:invisible">
          <MailReceiptBadge
            v-if="message.receipt"
            :receipt="message.receipt"
          />
          <UIcon
            v-if="message.hasAttachments"
            name="i-lucide-paperclip"
            class="size-3.5"
            aria-label="Has attachments"
          />
          <UIcon
            v-if="message.flagged"
            name="i-ph-flag-fill"
            class="size-3.5 text-(--lb-flag)"
            aria-label="Flagged"
          />
          <span
            class="w-14 text-end"
            :class="message.unread && 'font-semibold text-highlighted'"
          >{{ listDate(message.date) }}</span>
        </span>
      </UButton>

      <MailRowActions
        :message="message"
        class="absolute top-1/2 -translate-y-1/2 end-3 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto transition-opacity duration-100"
      />
    </div>
  </UContextMenu>
</template>
