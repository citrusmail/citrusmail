<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const props = defineProps<{
  folder: Folder
}>()

const { promptCreate, promptRename, promptDelete } = useFolderDialogs()

const items = computed<DropdownMenuItem[][]>(() => [[{
  label: 'Rename',
  icon: 'i-lucide-pencil',
  onSelect: () => promptRename(props.folder)
}, {
  label: 'New folder inside',
  icon: 'i-lucide-folder-plus',
  onSelect: () => promptCreate(props.folder.path)
}, {
  label: 'Filter mail into this folder',
  icon: 'i-lucide-list-filter',
  to: { path: '/settings/rules', query: { folder: props.folder.path } }
}], [{
  label: 'Delete',
  icon: 'i-lucide-trash-2',
  color: 'error',
  onSelect: () => promptDelete(props.folder)
}]])
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'start', side: 'right' }"
  >
    <UButton
      icon="i-lucide-ellipsis"
      color="neutral"
      variant="ghost"
      size="xs"
      :aria-label="`${folder.name} options`"
      class="-me-1.5 p-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
      @click.stop.prevent
    />
  </UDropdownMenu>
</template>
