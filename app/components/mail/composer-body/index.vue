<script setup lang="ts">
const { draft, isDirty, editor, discard } = useComposer()
const { writing } = useAiReply()
const { translating, fallback } = useReplyTranslation()

const editorEl = useTemplateRef('editorEl')
watchEffect(() => {
  editor.value = editorEl.value?.editor
})

const drop = useComposerDrop(() => editor.value)
const picker = useTemplateRef('picker')
const { attach } = useComposer()

async function picked(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.length) await attach(Array.from(input.files))
  input.value = ''
}
</script>

<template>
  <div
    class="relative flex flex-col min-h-0"
    @dragenter="drop.onEnter"
    @dragover="drop.onOver"
    @dragleave="drop.onLeave"
    @drop.prevent="drop.onDrop($event, 'attach')"
  >
    <UEditor
      ref="editorEl"
      v-slot="{ editor: instance }"
      v-model="draft.html"
      content-type="html"
      placeholder="Write your message"
      :image="{ allowBase64: true, HTMLAttributes: { style: 'max-width:100%;height:auto' } }"
      :editor-props="{ handlePaste: (_view: unknown, event: ClipboardEvent) => drop.onPaste(event) }"
      class="flex-1 flex flex-col min-h-0 overflow-y-auto"
      :class="[writing && 'lb-ai-writing', translating && fallback && 'lb-tr-editing']"
      :ui="{ content: 'order-1 px-5 pt-4 pb-5', base: 'px-0 sm:px-0 min-h-24 text-[15px] leading-normal text-default *:my-0 [&_p]:leading-normal [&_li]:my-0 [&_:is(ul,ol,blockquote,pre)]:my-2 [&_img]:rounded-md [&_img]:my-2 [&_img.ProseMirror-selectednode]:ring-2 [&_img.ProseMirror-selectednode]:ring-primary' }"
    >
      <MailComposerExtras class="order-2" />
      <!-- The space under the signature still puts the cursor in the message -->
      <div
        class="order-3 flex-1 min-h-6 cursor-text"
        @click="instance.commands.focus('end')"
      />

      <MailComposerAttachments class="order-3" />

      <footer class="order-4 sticky bottom-0 mt-auto flex items-center gap-1 px-3 py-2.5 border-t border-default bg-default">
        <UTooltip :text="isDirty ? 'Discard draft' : 'Close'">
          <UButton
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            :aria-label="isDirty ? 'Discard draft' : 'Close'"
            @click="discard"
          />
        </UTooltip>
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
          <MailComposerToolbar :editor="instance" />
          <MailSendButton class="ms-2" />
        </div>
      </footer>
    </UEditor>

    <MailDropZone :drop="drop" />
  </div>
</template>
