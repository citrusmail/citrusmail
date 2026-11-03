<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const props = defineProps<{
  rule: MailRule
}>()

const emit = defineEmits<{
  edit: []
  toggle: [enabled: boolean]
  remove: []
}>()

const { folders } = useMail()
const folder = computed(() => folders.value.find(item => item.path === props.rule.folder))

const items: DropdownMenuItem[][] = [[
  { label: 'Edit', icon: 'i-lucide-pencil', onSelect: () => emit('edit') }
], [
  { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => emit('remove') }
]]
</script>

<template>
  <li class="flex items-center gap-4 px-4 py-3.5">
    <USwitch
      :model-value="rule.enabled"
      :aria-label="rule.enabled ? 'Turn rule off' : 'Turn rule on'"
      @update:model-value="emit('toggle', $event)"
    />
    <UButton
      color="neutral"
      variant="link"
      class="flex-1 min-w-0 p-0 flex-col items-start gap-0 font-normal text-start"
      :class="!rule.enabled && 'opacity-60'"
      @click="emit('edit')"
    >
      <span class="block w-full text-sm text-highlighted truncate">{{ describeConditions(rule) }}</span>
      <span class="flex w-full items-center gap-1.5 text-sm text-muted mt-0.5">
        <UIcon
          name="i-lucide-corner-down-right"
          class="size-3.5 shrink-0"
        />
        <span class="truncate">Move to {{ folder?.name ?? rule.folder }}{{ rule.markRead ? ', mark as read' : '' }}</span>
      </span>
    </UButton>
    <UDropdownMenu
      :items="items"
      :content="{ align: 'end' }"
    >
      <UButton
        icon="i-lucide-ellipsis"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Rule options"
      />
    </UDropdownMenu>
  </li>
</template>
