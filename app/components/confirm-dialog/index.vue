<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  message?: string
  confirmLabel?: string
  color?: 'error' | 'primary'
}>(), {
  confirmLabel: 'Confirm',
  color: 'error'
})

const emit = defineEmits<{
  close: [confirmed: boolean]
}>()
</script>

<template>
  <UModal
    :title="title"
    :description="message"
    :close="false"
    :ui="{ content: 'sm:max-w-md', footer: 'justify-end gap-2' }"
    @update:open="(open: boolean) => !open && emit('close', false)"
  >
    <template #footer>
      <UButton
        label="Cancel"
        color="neutral"
        variant="ghost"
        @click="emit('close', false)"
      />
      <UButton
        :label="confirmLabel"
        :color="color"
        autofocus
        @click="emit('close', true)"
      />
    </template>
  </UModal>
</template>
