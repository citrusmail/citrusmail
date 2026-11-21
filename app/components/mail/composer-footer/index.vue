<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'

// The send bar: attach and tracking on the left; formatting, Send and, at
// the far end where it's hard to hit by accident, throwing the draft away
defineProps<{ editor?: Editor }>()

const { isDirty, discard, attach } = useComposer()
const picker = useTemplateRef('picker')

async function picked(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) await attach(Array.from(input.files))
  input.value = ''
}
</script>

<template>
  <footer class="flex items-center gap-1 px-3 py-2.5 border-t border-default bg-default">
    <UTooltip text="Attach files">
      <UButton
        icon="i-lucide-paperclip"
        color="neutral"
        variant="ghost"
        aria-label="Attach files"
        @click="picker?.click()"
      />
    </UTooltip>
    <MailReceiptToggle />
    <input
      ref="picker"
      type="file"
      multiple
      class="hidden"
      @change="picked"
    >

    <div class="ms-auto flex items-center gap-1">
      <MailComposerToolbar
        v-if="editor"
        :editor="editor"
      />
      <MailSendButton class="ms-2" />
      <UTooltip :text="isDirty ? 'Discard draft' : 'Close'">
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          :aria-label="isDirty ? 'Discard draft' : 'Close'"
          class="ms-1"
          @click="discard"
        />
      </UTooltip>
    </div>
  </footer>
</template>
