<script setup lang="ts">
// What's come back for a message you tracked: sent, delivered, opened, or bounced
const props = defineProps<{
  receipt: ReceiptStatus
  /** The reader spells out the whole date; the list keeps it short */
  full?: boolean
}>()

function when(at: string, verb: string) {
  if (props.full) return `${verb} at ${fullDate(at)}`
  const short = listDate(at)
  if (short.includes(':')) return `${verb} at ${short}`
  return short === 'Yesterday' ? `${verb} yesterday` : `${verb} ${short}`
}

const badge = computed(() => {
  const { delivered, opened, maybe, failed } = props.receipt
  if (failed) return { label: when(failed, 'Bounced'), icon: 'i-lucide-circle-x', color: 'error' as const, hint: 'The recipient’s server refused it. The bounce message in your Inbox says why.' }
  if (opened && maybe) return { label: when(opened, 'Maybe opened'), icon: 'i-lucide-mail-question', color: 'neutral' as const, hint: 'Apple Mail or a security scanner may have loaded it without anyone reading it.' }
  if (opened) return { label: when(opened, 'Opened'), icon: 'i-lucide-mail-open', color: 'success' as const, hint: `Opened at ${fullDate(opened)}` }
  if (delivered) return { label: when(delivered, 'Delivered'), icon: 'i-lucide-check', color: 'neutral' as const, hint: 'The recipient’s mail server accepted it. Not opened yet, or their app doesn’t say.' }
  return { label: 'Sent', icon: 'i-lucide-send-horizontal', color: 'neutral' as const, hint: 'Tracked. Nothing has come back yet.' }
})
</script>

<template>
  <UTooltip :text="badge.hint">
    <UBadge
      :label="badge.label"
      :icon="badge.icon"
      :color="badge.color"
      variant="soft"
      :size="full ? 'md' : 'sm'"
      class="shrink-0 tabular-nums"
    />
  </UTooltip>
</template>
