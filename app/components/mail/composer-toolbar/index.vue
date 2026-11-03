<script setup lang="ts">
import type { EditorToolbarItem } from '@nuxt/ui'
import type { Editor } from '@tiptap/vue-3'

defineProps<{
  editor: Editor
}>()

const items: EditorToolbarItem[][] = [[
  { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold', tooltip: { text: 'Bold', kbds: ['meta', 'b'] } },
  { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic', tooltip: { text: 'Italic', kbds: ['meta', 'i'] } },
  { kind: 'mark', mark: 'underline', icon: 'i-lucide-underline', tooltip: { text: 'Underline', kbds: ['meta', 'u'] } },
  { kind: 'mark', mark: 'strike', icon: 'i-lucide-strikethrough', tooltip: { text: 'Strikethrough' } }
], [
  { slot: 'link' as const, icon: 'i-lucide-link' },
  { kind: 'bulletList', icon: 'i-lucide-list', tooltip: { text: 'Bulleted list' } },
  { kind: 'orderedList', icon: 'i-lucide-list-ordered', tooltip: { text: 'Numbered list' } },
  { kind: 'blockquote', icon: 'i-lucide-text-quote', tooltip: { text: 'Quote' } }
]]
</script>

<template>
  <UEditorToolbar
    :editor="editor"
    :items="items"
    class="overflow-x-auto max-sm:hidden"
    :ui="{ separator: 'h-4' }"
  >
    <template #link>
      <EditorLinkPopover :editor="editor" />
    </template>
  </UEditorToolbar>
</template>
