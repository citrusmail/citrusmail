<script setup lang="ts">
// To, with Cc and Bcc unfolding below it when asked for (or when a draft has them)
const { open, draft, version } = useComposer()

const showCc = ref(false)
const showBcc = ref(false)
watch([open, version], ([value]) => {
  if (!value) return
  showCc.value = !!draft.value.cc.length
  showBcc.value = !!draft.value.bcc.length
}, { immediate: true })
</script>

<template>
  <MailRecipients
    v-model="draft.to"
    label="To"
    :autofocus="!draft.to.length"
  >
    <div class="flex items-center">
      <UButton
        v-if="!showCc"
        label="Cc"
        color="neutral"
        variant="link"
        size="sm"
        @click="showCc = true"
      />
      <UButton
        v-if="!showBcc"
        label="Bcc"
        color="neutral"
        variant="link"
        size="sm"
        @click="showBcc = true"
      />
    </div>
  </MailRecipients>
  <Transition name="lb-row">
    <MailRecipients
      v-if="showCc"
      v-model="draft.cc"
      label="Cc"
      :autofocus="!draft.cc.length"
    />
  </Transition>
  <Transition name="lb-row">
    <MailRecipients
      v-if="showBcc"
      v-model="draft.bcc"
      label="Bcc"
      :autofocus="!draft.bcc.length"
    />
  </Transition>
</template>
