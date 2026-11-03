<script setup lang="ts">
// Reading pane beside the list, or the list alone (messages open over it)
const { view } = useMailLayout()
</script>

<template>
  <UTooltip
    :text="view === 'split' ? 'Show the list alone' : 'Show the message beside the list'"
    :kbds="['shift', 'v']"
  >
    <UButton
      :icon="view === 'split' ? 'i-lucide-columns-2' : 'i-lucide-rows-3'"
      color="neutral"
      variant="ghost"
      size="sm"
      :aria-label="view === 'split' ? 'Switch to list view' : 'Switch to split view'"
      class="max-lg:hidden"
      @click="view = view === 'split' ? 'list' : 'split'"
    />
  </UTooltip>
</template>
