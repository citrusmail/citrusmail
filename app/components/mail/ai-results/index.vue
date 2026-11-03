<script setup lang="ts">
// AI search: the answer first, then the messages it found, from any folder
const { ai, selectedId, folders } = useMail()

const folderName = (path: string) => folders.value.find(item => item.path === path)?.name ?? path
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col">
    <div
      v-if="ai.status === 'idle'"
      class="p-6 text-sm text-muted text-pretty"
    >
      Ask the way you’d ask a person: “the boarding pass for my Lisbon trip”, “what did Sam say about the budget”, “receipts from last month”.
    </div>

    <div
      v-else-if="ai.status === 'loading'"
      class="p-5 flex flex-col gap-3"
      role="status"
    >
      <p class="text-sm text-toned">
        Looking through every folder<span class="lb-ai-dots" />
      </p>
      <USkeleton
        v-for="n in 4"
        :key="n"
        class="h-14 rounded-lg"
      />
    </div>

    <UEmpty
      v-else-if="ai.status === 'error'"
      icon="i-lucide-circle-alert"
      title="Search didn’t finish"
      :description="ai.error"
      variant="naked"
      class="flex-1"
    />

    <template v-else-if="ai.result">
      <div class="px-4 py-3 border-b border-default bg-(--lb-ai-bg)">
        <p class="text-[13px] text-muted mb-1">
          {{ ai.result.interpreted }}
        </p>
        <p class="text-sm text-highlighted text-pretty">
          {{ ai.result.answer }}
        </p>
      </div>
      <div class="flex-1 overflow-y-auto">
        <div
          v-for="message in ai.result.messages"
          :key="`${message.folder}/${message.id}`"
        >
          <MailListItem
            :message="message"
            :selected="message.id === selectedId"
            :note="folderName(message.folder)"
          />
        </div>
      </div>
    </template>
  </div>
</template>
