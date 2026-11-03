<script setup lang="ts">
const { compose } = useComposer()
const { open: openShortcuts } = useShortcutsHelp()
</script>

<template>
  <UEmpty
    icon="i-lucide-mail-open"
    title="No message selected"
    description="Pick a message from the list, or use j and k to move through it."
    variant="naked"
    :actions="[
      { label: 'New message', icon: 'i-lucide-square-pen', onClick: () => compose() },
      { label: 'Shortcuts', icon: 'i-lucide-keyboard', color: 'neutral', variant: 'subtle', onClick: openShortcuts }
    ]"
  />
</template>
