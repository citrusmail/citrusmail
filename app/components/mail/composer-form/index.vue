<script setup lang="ts">
// Who it's from and to, the subject and the message
// `from`: the docked composer shows who it's from in its title bar instead
withDefaults(defineProps<{ footer?: boolean, from?: boolean }>(), { footer: true, from: true })

const { draft, version, focusBody } = useComposer()
const { ready } = useAi()
const { account } = useShell()

// The editor comes after the signature and attachments in the page, so Tab
// from the subject goes straight to it instead of through them
function onSubjectKey(event: KeyboardEvent) {
  if (event.key !== 'Tab' || event.shiftKey) return
  event.preventDefault()
  focusBody()
}
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <MailComposerField
      v-if="from"
      label="From"
    >
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
      :footer="footer"
      class="flex-1 min-h-0"
    />
  </div>
</template>
