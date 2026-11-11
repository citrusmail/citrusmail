<script setup lang="ts">
const props = defineProps<{
  id: string
  folder: string
  /** List view: the reader covers the list and offers a way back */
  back?: boolean
}>()

const { messages, shown, setUnread } = useMail()
const { reply, forward } = useComposer()
const cache = useMessageCache()

const showImages = ref(false)

// The copy on hand shows at once; otherwise the server is asked
const message = ref<MessageDetail>()
const status = ref<'pending' | 'success' | 'error'>('pending')

async function load() {
  const { folder, id } = props
  const images = showImages.value
  const hit = cache.cached(folder, id, images)
  message.value = hit?.message ?? (images ? message.value : undefined)
  status.value = hit ? 'success' : 'pending'
  try {
    const entry = await cache.open(folder, id, images)
    if (props.id !== id || props.folder !== folder || showImages.value !== images) return
    message.value = entry.message
    status.value = 'success'
    // Opening marks it read: the server did, unless it was fetched ahead
    const item = messages.value.find(row => row.id === id)
    if (item?.unread) setUnread(item, false, entry.marked)
  } catch {
    if (props.id === id) status.value = 'error'
  }
  // The messages either side are likely next
  const index = shown.value.findIndex(row => row.id === id && row.folder === folder)
  if (index !== -1) cache.prefetch([shown.value[index + 1], shown.value[index - 1], shown.value[index + 2]].filter(row => row !== undefined))
}

watch(() => [props.id, props.folder, showImages.value], load, { immediate: true })
const refresh = load

const summary = computed(() => messages.value.find(item => item.id === props.id))
const content = useTemplateRef('content')

defineShortcuts({
  r: () => message.value && reply(message.value),
  a: () => message.value && reply(message.value, true),
  f: () => message.value && forward(message.value)
})
</script>

<template>
  <article class="flex flex-col min-w-0 min-h-0 bg-default">
    <MailReaderHeader
      :summary="summary"
      :message="message ?? undefined"
      :back="back"
      :translation="content?.translationState"
      @summarize="content?.summarize()"
      @translate="content?.translate()"
    />

    <div
      v-if="status === 'pending' && !message"
      class="flex-1 p-6 flex flex-col gap-4"
    >
      <USkeleton class="h-7 w-2/3" />
      <div class="flex items-center gap-3">
        <USkeleton class="size-10 rounded-full" />
        <div class="flex-1 flex flex-col gap-2">
          <USkeleton class="h-4 w-1/3" />
          <USkeleton class="h-3 w-1/4" />
        </div>
      </div>
      <USkeleton class="h-64 w-full rounded-xl" />
    </div>

    <UEmpty
      v-else-if="status === 'error'"
      icon="i-lucide-mail-x"
      title="Couldn’t open this message"
      description="It may have been moved or deleted from another device."
      :actions="[{ label: 'Try again', icon: 'i-lucide-rotate-cw', color: 'neutral', variant: 'subtle', onClick: () => refresh() }]"
      variant="naked"
      class="flex-1"
    />

    <MailReaderContent
      v-else-if="message"
      ref="content"
      v-model:show-images="showImages"
      :message="message"
      class="flex-1 overflow-y-auto"
    />
  </article>
</template>
