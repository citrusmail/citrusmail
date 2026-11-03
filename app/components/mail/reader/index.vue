<script setup lang="ts">
const props = defineProps<{
  id: string
  folder: string
  /** List view: the reader covers the list and offers a way back */
  back?: boolean
}>()

const { messages, setUnread } = useMail()
const { reply, forward } = useComposer()

const showImages = ref(false)

const { data: message, status, refresh } = useFetch<MessageDetail>(() => `/api/messages/${encodeURIComponent(props.id)}`, {
  query: computed(() => ({ folder: props.folder, images: showImages.value ? 1 : undefined })),
  server: false
})

// The server marks a message read as it is opened; the list follows suit
watch(message, (value) => {
  const summary = messages.value.find(item => item.id === props.id)
  if (value && summary?.unread) setUnread(summary, false, true)
}, { immediate: true })

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
