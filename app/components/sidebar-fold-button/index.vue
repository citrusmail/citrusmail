<script setup lang="ts">
// Folds the sidebar to icons and back. Sits by your name, out of the way of the logo
defineProps<{
  collapsed: boolean
}>()

const { toggleSidebar } = useShell()
</script>

<template>
  <UTooltip
    :text="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
    :kbds="['[']"
    :content="{ side: 'right' }"
  >
    <UButton
      :icon="collapsed ? 'i-lucide-chevrons-right' : 'i-lucide-chevrons-left'"
      color="neutral"
      variant="ghost"
      size="sm"
      square
      :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      class="max-lg:hidden shrink-0 text-dimmed hover:text-highlighted"
      @click="toggleSidebar"
    />
  </UTooltip>
</template>
