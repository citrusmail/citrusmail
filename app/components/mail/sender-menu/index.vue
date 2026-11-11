<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

// More for this message: who it's from goes on your allow or block list
const props = defineProps<{
  message: MessageDetail
}>()

const { allow, block, remove, isAllowed, isBlocked } = useSenders()
const { account } = useShell()

const address = computed(() => props.message.from.address)
const domain = computed(() => `@${address.value.split('@')[1] ?? ''}`)

const items = computed<DropdownMenuItem[][]>(() => {
  // The lists are applied over IMAP
  if (!address.value || account.value?.protocol !== 'imap') return []
  const allowed = isAllowed(address.value)
  const blocked = isBlocked(address.value)
  return [[
    allowed
      ? { label: `Remove ${address.value} from allowed`, icon: 'i-lucide-shield-minus', onSelect: () => remove(address.value) }
      : { label: 'Always allow this sender', description: 'Their images load, and their mail never lands in Junk', icon: 'i-lucide-shield-check', onSelect: () => allow(address.value) }
  ], [
    blocked
      ? { label: `Unblock ${address.value}`, icon: 'i-lucide-shield-off', onSelect: () => remove(address.value) }
      : { label: `Block ${address.value}`, icon: 'i-lucide-ban', color: 'error' as const, onSelect: () => block(address.value) },
    { label: `Block everyone at ${domain.value}`, icon: 'i-lucide-ban', color: 'error' as const, onSelect: () => block(domain.value) }
  ]]
})
</script>

<template>
  <UDropdownMenu
    v-if="items.length"
    :items="items"
    :content="{ align: 'end' }"
  >
    <UButton
      icon="i-lucide-ellipsis"
      color="neutral"
      variant="ghost"
      aria-label="More"
    />
  </UDropdownMenu>
</template>
