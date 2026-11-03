<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const props = defineProps<{
  summary?: MessageSummary
}>()

const { folders, folder, move, remove } = useMail()
const { account } = useShell()
const { promptCreate } = useFolderDialogs()

async function moveToNew() {
  const message = props.summary
  if (!message) return
  const path = await promptCreate()
  if (path) await move(message, path)
}

const moveItems = computed<DropdownMenuItem[][]>(() => [
  folders.value
    .filter(item => item.path !== props.summary?.folder)
    .map(item => ({
      label: item.name,
      icon: folderIcon(item),
      onSelect: () => props.summary && move(props.summary, item.path)
    })),
  account.value?.protocol === 'pop3' ? [] : [{ label: 'New folder…', icon: 'i-lucide-folder-plus', onSelect: moveToNew }]
])

function act(handler: (message: MessageSummary) => void) {
  return () => props.summary && handler(props.summary)
}
</script>

<template>
  <UFieldGroup>
    <UTooltip
      text="Archive"
      :kbds="['e']"
    >
      <UButton
        icon="i-lucide-archive"
        color="neutral"
        variant="ghost"
        aria-label="Archive"
        :disabled="!summary || folder?.role === 'archive'"
        @click="act(message => move(message, 'archive'))()"
      />
    </UTooltip>
    <UTooltip
      text="Delete"
      :kbds="['#']"
    >
      <UButton
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        aria-label="Delete"
        :disabled="!summary"
        @click="act(remove)()"
      />
    </UTooltip>
    <UTooltip :text="folder?.role === 'junk' ? 'Not junk' : 'Junk'">
      <UButton
        icon="i-lucide-shield-alert"
        color="neutral"
        variant="ghost"
        :aria-label="folder?.role === 'junk' ? 'Not junk' : 'Move to Junk'"
        :disabled="!summary"
        @click="act(message => move(message, folder?.role === 'junk' ? 'inbox' : 'junk'))()"
      />
    </UTooltip>
    <UDropdownMenu
      :items="moveItems"
      :content="{ align: 'start' }"
      :ui="{ content: 'max-h-80' }"
    >
      <UTooltip text="Move to…">
        <UButton
          icon="i-lucide-folder-input"
          color="neutral"
          variant="ghost"
          aria-label="Move to folder"
          :disabled="!summary"
        />
      </UTooltip>
    </UDropdownMenu>
  </UFieldGroup>
</template>
