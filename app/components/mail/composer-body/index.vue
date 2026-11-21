<script setup lang="ts">
// Without its footer, the send bar goes where the page puts it (a forward
// puts it under the message being passed on)
withDefaults(defineProps<{ footer?: boolean }>(), { footer: true })

const { draft, editor } = useComposer()
const { writing } = useAiReply()
const { translating, fallback } = useReplyTranslation()

const editorEl = useTemplateRef('editorEl')
watchEffect(() => {
  editor.value = editorEl.value?.editor
})

const drop = useComposerDrop(() => editor.value)
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
      data-composer-scroll
      class="flex-1 flex flex-col min-h-0 overflow-y-auto"
      :class="[writing && 'lb-ai-writing', translating && fallback && 'lb-tr-editing']"
      :ui="{ content: 'order-1 flex-none !h-auto px-5 pt-4 pb-0', base: 'px-0 sm:px-0 min-h-[3em] text-[15px] leading-normal text-default *:my-0 [&_p]:leading-normal [&_li]:my-0 [&_:is(ul,ol,blockquote,pre)]:my-2 [&_img]:rounded-md [&_img]:my-2 [&_img.ProseMirror-selectednode]:ring-2 [&_img.ProseMirror-selectednode]:ring-primary' }"
    >
      <MailComposerExtras class="order-2" />
      <!-- The space under the signature still puts the cursor in the message -->
      <div
        class="order-3 flex-1 min-h-6 cursor-text"
        @click="instance.commands.focus('end')"
      />

      <MailComposerAttachments class="order-3" />
    </UEditor>

    <!-- Outside the scrolling message, so Send stays put however long it gets -->
    <MailComposerFooter
      v-if="footer"
      :editor="editor"
      class="shrink-0 sticky bottom-0"
    />

    <MailDropZone :drop="drop" />
  </div>
</template>
