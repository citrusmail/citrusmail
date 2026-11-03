<script setup lang="ts">
const props = defineProps<{
  message: MessageSummary
}>()

const { folder, setUnread, toggleFlag, move, remove } = useMail()
</script>

<template>
  <div class="flex items-center rounded-md bg-default ring ring-default p-0.5">
    <UTooltip
      v-if="folder?.role !== 'archive'"
      text="Archive"
      :kbds="['e']"
    >
      <UButton
        icon="i-lucide-archive"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Archive"
        @click.stop="move(props.message, 'archive')"
      />
    </UTooltip>
    <UTooltip
      text="Delete"
      :kbds="['#']"
    >
      <UButton
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        size="xs"
        aria-label="Delete"
        @click.stop="remove(props.message)"
      />
    </UTooltip>
    <UTooltip :text="message.unread ? 'Mark as read' : 'Mark as unread'">
      <UButton
        :icon="message.unread ? 'i-lucide-mail-open' : 'i-lucide-mail'"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="message.unread ? 'Mark as read' : 'Mark as unread'"
        @click.stop="setUnread(props.message, !message.unread)"
      />
    </UTooltip>
    <UTooltip
      :text="message.flagged ? 'Remove flag' : 'Flag'"
      :kbds="['s']"
    >
      <UButton
        :icon="message.flagged ? 'i-ph-flag-fill' : 'i-lucide-flag'"
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="message.flagged ? 'Remove flag' : 'Flag'"
        :ui="{ leadingIcon: message.flagged ? 'text-(--lb-flag)' : '' }"
        @click.stop="toggleFlag(props.message)"
      />
    </UTooltip>
  </div>
</template>
