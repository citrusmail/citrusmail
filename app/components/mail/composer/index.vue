<script setup lang="ts">
const { open, draft, version, focusBody, close } = useComposer()
const { ready } = useAi()
const { account } = useShell()

const title = computed(() => {
  if (draft.value.inReplyTo) return 'Reply'
  if (/^fwd:/i.test(draft.value.subject)) return 'Forward'
  return draft.value.savedAs ? 'Draft' : 'New message'
})

// The editor comes after the signature and attachments in the page, so Tab
// from the subject goes straight to it instead of through them
function onSubjectKey(event: KeyboardEvent) {
  if (event.key !== 'Tab' || event.shiftKey) return
  event.preventDefault()
  focusBody()
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :ui="{
      content: 'sm:max-w-[46rem] sm:h-[min(48rem,calc(100dvh-4rem))] flex flex-col divide-y-0',
      header: 'h-12 min-h-12 py-0 px-5 border-b border-default',
      title: 'text-sm font-semibold',
      close: 'top-2 end-3',
      body: 'p-0! flex-1 flex flex-col min-h-0'
    }"
    @update:open="value => value ? (open = true) : close()"
  >
    <template #body>
      <MailComposerField label="From">
        <span class="text-sm text-toned truncate">
          {{ account?.name ? `${account.name} <${account.email}>` : account?.email }}
        </span>
      </MailComposerField>

      <MailComposerRecipients />

      <MailComposerField label="Subject">
        <UInput
          v-model="draft.subject"
          aria-label="Subject"
          variant="none"
          :autofocus="!!draft.to.length && !draft.subject"
          :ui="{ base: 'px-0 h-11 text-[15px] font-semibold text-highlighted' }"
          @keydown="onSubjectKey"
        />
      </MailComposerField>

      <MailComposerAi v-if="ready && draft.replyingTo" />
      <MailComposerTranslate v-if="ready && draft.translateTo" />

      <MailComposerBody
        :key="version"
        class="flex-1 min-h-0"
      />
    </template>
  </UModal>
</template>
