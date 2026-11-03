<script setup lang="ts">
// Shown on mail that carries an unsubscribe link (List-Unsubscribe)
const props = defineProps<{
  message: MessageDetail
}>()

const { busy, unsubscribe } = useUnsubscribe()
const done = ref(false)

async function run() {
  done.value = await unsubscribe({ folder: props.message.folder, id: props.message.id }, personName(props.message.from))
}
</script>

<template>
  <UTooltip :text="done ? 'Unsubscribed' : UNSUBSCRIBE_HINT[message.unsubscribe!]">
    <UButton
      :icon="done ? 'i-lucide-check' : message.unsubscribe === 'link' ? 'i-lucide-external-link' : 'i-lucide-mail-x'"
      :label="done ? 'Unsubscribed' : 'Unsubscribe'"
      color="neutral"
      variant="ghost"
      size="sm"
      :loading="busy"
      :disabled="done"
      class="max-sm:[&>span:last-child]:sr-only"
      :ui="{ leadingIcon: done ? 'text-success' : '' }"
      @click="run"
    />
  </UTooltip>
</template>
