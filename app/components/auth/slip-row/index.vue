<script setup lang="ts">
defineProps<{
  label: string
  icon: string
  value?: string
  optional?: boolean
  state: 'idle' | 'looking' | 'found' | 'missing'
}>()
</script>

<template>
  <li class="flex items-center gap-3 px-5 py-3.5">
    <UIcon
      :name="icon"
      class="size-[18px] shrink-0"
      :class="state === 'found' ? 'text-highlighted' : 'text-dimmed'"
    />
    <div class="flex-1 min-w-0">
      <p class="text-sm text-muted">
        {{ label }}
      </p>
      <p
        class="text-[15px] truncate transition-colors"
        :class="state === 'found' ? 'text-highlighted font-medium' : 'text-dimmed'"
      >
        <template v-if="state === 'found'">
          {{ value }}
        </template>
        <template v-else-if="state === 'looking'">
          Looking
        </template>
        <template v-else-if="state === 'missing'">
          {{ optional ? 'Not offered, you can add it later' : 'Enter it in server settings' }}
        </template>
        <template v-else>
          Not looked up yet
        </template>
      </p>
    </div>
    <UIcon
      v-if="state === 'looking'"
      name="i-lucide-loader-circle"
      class="size-4 text-dimmed animate-spin"
    />
    <UIcon
      v-else-if="state === 'found'"
      name="i-lucide-check"
      class="size-4 text-primary"
    />
    <UIcon
      v-else-if="state === 'missing' && !optional"
      name="i-lucide-circle-alert"
      class="size-4 text-(--lb-flag)"
    />
  </li>
</template>
