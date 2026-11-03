<script setup lang="ts">
defineProps<{
  label: string
  value: string
  icon: string
  to?: string
  /** Renders the value as a button that emits open */
  action?: boolean
}>()

const emit = defineEmits<{
  open: []
}>()

const { copy, copied } = useClipboard()
</script>

<template>
  <div class="group flex items-center gap-3 px-4 py-3">
    <UIcon
      :name="icon"
      class="size-4 text-muted shrink-0"
    />
    <div class="flex-1 min-w-0">
      <p class="text-xs text-muted">
        {{ label }}
      </p>
      <UButton
        v-if="to || action"
        :label="value"
        :to="to"
        variant="link"
        class="p-0 max-w-full"
        :ui="{ label: 'truncate' }"
        @click="!to && emit('open')"
      />
      <p
        v-else
        class="text-sm text-highlighted whitespace-pre-wrap break-words"
      >
        {{ value }}
      </p>
    </div>
    <UTooltip :text="copied ? 'Copied' : 'Copy'">
      <UButton
        :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Copy"
        class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
        @click="copy(value)"
      />
    </UTooltip>
  </div>
</template>
