<script setup lang="ts">
const { messages, status, cursor, load, folder, search, filter, filtering, selectedId } = useMail()
const { view } = useMailLayout()
const { isMobile } = useShell()
// The list-only view packs a message into one line
const compact = computed(() => view.value === 'list' && !isMobile.value)

const scroller = useTemplateRef('scroller')
const scrollEl = computed(() => scroller.value?.$el as HTMLElement | undefined)

useInfiniteScroll(scrollEl, () => load(false), {
  distance: 600,
  canLoadMore: () => !!cursor.value && status.value === 'idle'
})

// Keep the selected row in view as j/k walks past the edge
watch(selectedId, (id) => {
  if (!id) return
  nextTick(() => scrollEl.value?.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' }))
})

const empty = computed(() => {
  if (filtering.value) return { icon: 'i-lucide-search-x', title: 'No matches', description: `Nothing in ${folder.value?.name ?? 'this folder'} matches${search.value ? ` “${search.value}”` : ''} with these filters.` }
  if (filter.value === 'flagged') return { icon: 'i-lucide-flag', title: 'Nothing flagged', description: 'Press S on a message to flag it for later.' }
  if (search.value) return { icon: 'i-lucide-search-x', title: 'No matches', description: `Nothing in ${folder.value?.name ?? 'this folder'} matches “${search.value}”.` }
  if (filter.value === 'unread') return { icon: 'i-lucide-check-check', title: 'All read', description: 'You’re caught up.' }
  return { icon: folderIcon(folder.value), title: `${folder.value?.name ?? 'This folder'} is empty`, description: folder.value?.role === 'inbox' ? 'New mail shows up here on its own.' : undefined }
})
</script>

<template>
  <div
    v-if="status === 'loading' && !messages.length"
    class="flex-1 flex flex-col"
  >
    <div
      v-for="n in 8"
      :key="n"
      class="flex gap-3 ps-6 pe-4 py-3.5 border-b border-default"
    >
      <USkeleton class="size-8 rounded-full shrink-0" />
      <div class="flex-1 flex flex-col gap-2">
        <USkeleton class="h-3.5 w-2/5" />
        <USkeleton class="h-3.5 w-4/5" />
        <USkeleton class="h-3 w-11/12" />
      </div>
    </div>
  </div>

  <UEmpty
    v-else-if="!messages.length"
    v-bind="empty"
    variant="naked"
    class="flex-1"
  />

  <UScrollArea
    v-else
    ref="scroller"
    :key="compact ? 'compact' : 'roomy'"
    :items="messages"
    :virtualize="{ estimateSize: compact ? 41 : 84, overscan: 8 }"
    class="flex-1 transition-opacity"
    :class="status === 'loading' && 'opacity-60'"
    :ui="{ viewport: 'pb-6' }"
  >
    <template #default="{ item }">
      <MailListItemCompact
        v-if="compact"
        :message="item as MessageSummary"
        :selected="item.id === selectedId"
        :sent="folder?.role === 'sent' || folder?.role === 'drafts'"
      />
      <MailListItem
        v-else
        :message="item as MessageSummary"
        :selected="item.id === selectedId"
        :sent="folder?.role === 'sent' || folder?.role === 'drafts'"
      />
    </template>
  </UScrollArea>

  <div
    v-if="status === 'more'"
    class="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none"
  >
    <UBadge
      icon="i-lucide-loader-circle"
      label="Loading more"
      color="neutral"
      variant="soft"
      class="rounded-full ring ring-default bg-default"
      :ui="{ leadingIcon: 'animate-spin' }"
    />
  </div>
</template>
