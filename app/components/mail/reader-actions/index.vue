<script setup lang="ts">
// Under the message: answer it, pass it on, or (in Drafts) carry on writing it
const props = defineProps<{
  message: MessageDetail
}>()

const { folders } = useMail()
const { reply, forward, editDraft } = useComposer()
const { ready } = useAi()
const { replyWithAi } = useAiReply()

const isDraft = computed(() => folders.value.find(item => item.path === props.message.folder)?.role === 'drafts')
const many = computed(() => props.message.to.length + props.message.cc.length > 1)
</script>

<template>
  <div class="flex flex-wrap gap-2 pt-2 pb-8">
    <UButton
      v-if="isDraft"
      icon="i-lucide-pen-line"
      label="Continue editing"
      @click="editDraft(message)"
    />
    <template v-else>
      <UButton
        v-if="ready"
        icon="i-lucide-sparkles"
        label="AI Reply"
        color="neutral"
        variant="outline"
        class="text-highlighted"
        :ui="{ leadingIcon: 'text-(--lb-ai)' }"
        @click="replyWithAi(message)"
      />
      <UButton
        icon="i-lucide-reply"
        label="Reply"
        color="neutral"
        variant="outline"
        @click="reply(message)"
      />
      <UButton
        v-if="many"
        icon="i-lucide-reply-all"
        label="Reply all"
        color="neutral"
        variant="outline"
        @click="reply(message, true)"
      />
      <UButton
        icon="i-lucide-forward"
        label="Forward"
        color="neutral"
        variant="outline"
        @click="forward(message)"
      />
    </template>
  </div>
</template>
