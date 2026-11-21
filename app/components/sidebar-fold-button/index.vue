<script setup lang="ts">
// Folds the sidebar to icons and back: a panel icon, the way Mac apps do it
defineProps<{
  collapsed: boolean
}>()

const { toggleSidebar } = useShell()
</script>

<template>
  <UTooltip
    :text="collapsed ? 'Show sidebar' : 'Hide sidebar'"
    :kbds="['[']"
    :content="{ side: collapsed ? 'right' : 'bottom' }"
  >
    <UButton
      :icon="collapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
      color="neutral"
      variant="ghost"
      size="sm"
      square
      :aria-label="collapsed ? 'Show sidebar' : 'Hide sidebar'"
      class="max-lg:hidden shrink-0 text-muted hover:text-highlighted hover:bg-(--lb-tab-active)/55"
      @click="toggleSidebar"
    />
  </UTooltip>
</template>
