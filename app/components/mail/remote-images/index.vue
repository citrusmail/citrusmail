<script setup lang="ts">
// One quiet line in the sender's block instead of a banner on every message:
// show them this once, or always for this sender
const props = defineProps<{
  message: MessageDetail
}>()

const emit = defineEmits<{
  show: []
}>()

const { allow } = useSenders()
const { account } = useShell()

async function always() {
  emit('show')
  await allow(props.message.from.address)
}
</script>

<template>
  <p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
    <UTooltip text="Loading them tells the sender you opened this message.">
      <span class="inline-flex items-center gap-1.5">
        <UIcon
          name="i-lucide-image-off"
          class="size-3.5"
        />
        Images hidden
      </span>
    </UTooltip>
    <UButton
      label="Show"
      color="neutral"
      variant="link"
      size="xs"
      class="p-0 text-xs text-toned"
      @click="emit('show')"
    />
    <template v-if="account?.protocol !== 'pop3' && message.from.address">
      <UButton
        :label="`Always show from ${personName(message.from)}`"
        color="neutral"
        variant="link"
        size="xs"
        class="p-0 text-xs text-toned"
        @click="always"
      />
    </template>
  </p>
</template>
