<script setup lang="ts">
const props = defineProps<{
  message: MessageSummary
  selected: boolean
  /** Sent and Drafts show who it went to rather than who it came from */
  sent?: boolean
  /** A short line under the preview, e.g. the folder an AI search found it in */
  note?: string
}>()

const { selectedId } = useMail()
const menu = useMessageActions(() => props.message)

const person = computed(() => props.sent
  ? props.message.to.map(personName).join(', ') || 'No recipients'
  : personName(props.message.from))

const avatarAddress = computed(() => props.sent ? props.message.to[0] : props.message.from)
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
        class="items-start justify-start text-start gap-3 ps-2 pe-4 py-3 rounded-none font-normal"
        :class="selected ? 'bg-(--lb-selected) hover:bg-(--lb-selected)' : 'hover:bg-elevated/60'"
        @click="selectedId = message.id"
      >
        <span
          class="mt-[15px] size-2 shrink-0 rounded-full"
          :class="message.unread ? 'bg-(--lb-unread)' : 'bg-transparent'"
          :aria-label="message.unread ? 'Unread' : undefined"
        />

        <SenderAvatar
          :address="avatarAddress"
          size="md"
        />

        <span class="flex-1 min-w-0">
          <span class="flex items-baseline gap-2">
            <span
              class="flex-1 truncate text-[15px] text-highlighted"
              :class="message.unread ? 'font-semibold' : 'font-medium'"
            >
              <span
                v-if="sent"
                class="text-muted font-normal"
              >To </span>{{ person }}
            </span>
            <span class="shrink-0 flex items-center gap-1.5 text-xs text-muted tabular-nums">
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
              {{ listDate(message.date) }}
            </span>
          </span>

          <span class="flex items-center gap-2 mt-0.5">
            <span
              class="flex-1 truncate text-sm"
              :class="message.unread ? 'font-semibold text-highlighted' : 'text-toned'"
            >{{ message.subject || '(No subject)' }}</span>
            <MailReceiptBadge
              v-if="message.receipt"
              :receipt="message.receipt"
            />
          </span>

          <span class="block text-sm text-muted truncate mt-0.5">
            {{ message.preview }}
          </span>
          <span
            v-if="note"
            class="inline-flex items-center gap-1 mt-1 text-xs text-dimmed"
          >
            <UIcon
              name="i-lucide-folder"
              class="size-3"
            />{{ note }}
          </span>
        </span>
      </UButton>

      <MailRowActions
        :message="message"
        class="absolute top-2 end-3 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto transition-opacity duration-100"
      />
    </div>
  </UContextMenu>
</template>
