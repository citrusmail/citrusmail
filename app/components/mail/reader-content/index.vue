<script setup lang="ts">
const props = defineProps<{
  message: MessageDetail
}>()

const showImages = defineModel<boolean>('showImages', { required: true })

const summaryEl = useTemplateRef('summaryEl')
const summaryOpen = ref(false)

async function summarize() {
  summaryOpen.value = true
  await nextTick()
  summaryEl.value?.run()
}

const body = useTemplateRef('body')
const subject = useTemplateRef('subject')
const translation = useMessageTranslation(() => props.message, () => [subject.value, body.value?.root()])

defineExpose({ summarize, translate: translation.toggle, translationState: translation.state })

const hasRemote = computed(() => props.message.remoteContent && !showImages.value && !props.message.remoteShown)
</script>

<template>
  <div>
    <div class="max-w-4xl mx-auto px-4 sm:px-8 py-6 flex flex-col gap-5">
      <!-- Its text is set by hand, so translation can swap it like the body's -->
      <h1 class="text-2xl font-bold tracking-tight text-highlighted text-pretty">
        <span
          ref="subject"
          v-text="message.subject || '(No subject)'"
        />
      </h1>

      <MailSender :message="message">
        <MailReceiptBadge
          v-if="message.receipt"
          :receipt="message.receipt"
          full
          class="self-start"
        />
        <MailRemoteImages
          v-if="hasRemote"
          :message="message"
          @show="showImages = true"
        />
      </MailSender>

      <MailTranslateBar :translation="translation" />

      <Transition name="lb-summary">
        <MailAiSummary
          v-if="summaryOpen"
          ref="summaryEl"
          :message="message"
          @close="summaryOpen = false"
        />
      </Transition>

      <MailBody
        ref="body"
        :message="message"
        :remote="showImages || message.remoteShown"
        @rendered="translation.rendered()"
      />

      <MailAttachments
        v-if="message.attachments.length"
        :message="message"
      />

      <MailReaderActions :message="message" />
    </div>
  </div>
</template>
