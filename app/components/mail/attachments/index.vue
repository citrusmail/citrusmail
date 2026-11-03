<script setup lang="ts">
const props = defineProps<{
  message: MessageDetail
}>()

function url(index: number) {
  return `/api/messages/${encodeURIComponent(props.message.id)}/attachments/${index}?folder=${encodeURIComponent(props.message.folder)}`
}
</script>

<template>
  <section>
    <h2 class="text-sm font-medium text-muted mb-2">
      {{ message.attachments.length === 1 ? '1 attachment' : `${message.attachments.length} attachments` }}
    </h2>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <UButton
        v-for="file in message.attachments"
        :key="file.index"
        :to="url(file.index)"
        target="_blank"
        external
        color="neutral"
        variant="outline"
        :icon="attachmentIcon(file.contentType)"
        class="justify-start gap-3 p-3 rounded-lg"
        :ui="{ leadingIcon: 'size-6 text-muted' }"
      >
        <span class="flex-1 min-w-0 text-start">
          <span class="block truncate text-sm font-medium text-highlighted">{{ file.filename }}</span>
          <span class="block text-xs text-muted">{{ formatSize(file.size) }}</span>
        </span>
        <UIcon
          name="i-lucide-download"
          class="size-4 text-dimmed"
        />
      </UButton>
    </div>
  </section>
</template>
