<script setup lang="ts">
// An address in the message header: hover shows a copy icon, a click copies it
const props = defineProps<{
  address: Address
  /** Show only the address, for the line next to the sender's name */
  bare?: boolean
  /** A soft pill with the person's avatar, for the recipient rows */
  chip?: boolean
}>()

const { copy, copied } = useClipboard({ copiedDuring: 1400, legacy: true })
const toast = useToast()

async function onClick() {
  await copy(props.address.address)
  if (!copied.value) toast.add({ title: 'Couldn’t copy', description: props.address.address, color: 'error', icon: 'i-lucide-circle-alert' })
}
</script>

<template>
  <RevealButton
    icon="i-lucide-copy"
    :done="copied"
    :aria-label="copied ? `Copied ${address.address}` : `Copy ${address.address}`"
    :class="chip && 'mx-0 ps-0.5 pe-2 py-0.5 gap-1.5 rounded-full bg-elevated hover:bg-accented/70 text-[13px] text-default'"
    @click="onClick"
  >
    <SenderAvatar
      v-if="chip"
      :address="address"
      size="3xs"
    />
    <span
      v-if="chip"
      class="truncate"
    >{{ address.name || address.address }}<span
      v-if="address.name"
      class="ms-1 text-muted"
    >{{ address.address }}</span></span>
    <span
      v-else-if="!bare && address.name"
      class="truncate"
    >{{ address.name }}<span class="ms-1 text-muted">{{ address.address }}</span></span>
    <span
      v-else
      class="truncate"
    >{{ address.address }}</span>
  </RevealButton>
</template>
