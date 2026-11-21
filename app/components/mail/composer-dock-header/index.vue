<script setup lang="ts">
// The docked composer's title bar: what you're writing and who it's from,
// fold down, open out large, and close (which keeps what you wrote in Drafts).
// Folded down, the whole bar opens it again
defineProps<{ title: string }>()

const { minimized, expanded, isDirty, close } = useComposer()
const { account } = useShell()

function toggleSize() {
  minimized.value = false
  expanded.value = !expanded.value
}
</script>

<template>
  <header
    class="shrink-0 flex items-center gap-2 h-11 ps-4 pe-1.5"
    :class="minimized ? 'cursor-pointer hover:bg-elevated/60' : 'border-b border-default'"
    @click="minimized && (minimized = false)"
  >
    <h2 class="min-w-0 truncate text-sm font-semibold text-highlighted">
      {{ title }}
    </h2>
    <span
      v-if="!minimized && account"
      class="min-w-0 truncate text-xs text-muted max-sm:hidden"
    >from {{ account.email }}</span>

    <div class="ms-auto flex items-center">
      <UTooltip :text="minimized ? 'Open' : 'Minimize'">
        <UButton
          :icon="minimized ? 'i-lucide-chevron-up' : 'i-lucide-minus'"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="minimized ? 'Open' : 'Minimize'"
          class="max-sm:hidden"
          @click.stop="minimized = !minimized"
        />
      </UTooltip>
      <UTooltip :text="expanded ? 'Dock in the corner' : 'Make larger'">
        <UButton
          :icon="expanded ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="expanded ? 'Dock in the corner' : 'Make larger'"
          class="max-sm:hidden"
          @click.stop="toggleSize"
        />
      </UTooltip>
      <UTooltip :text="isDirty ? 'Close and keep in Drafts' : 'Close'">
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-label="isDirty ? 'Close and keep in Drafts' : 'Close'"
          @click.stop="close"
        />
      </UTooltip>
    </div>
  </header>
</template>
