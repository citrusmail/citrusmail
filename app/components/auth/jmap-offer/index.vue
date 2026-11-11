<script setup lang="ts">
// Discovery found a JMAP server: sign-in uses it, with IMAP one click away
defineProps<{
  active: boolean
  /** The address has IMAP or POP3 too */
  canSwitch: boolean
}>()

const emit = defineEmits<{
  choose: [jmap: boolean]
}>()
</script>

<template>
  <p class="-mt-2 text-xs text-muted flex items-center gap-1.5">
    <UIcon
      name="i-lucide-zap"
      class="size-3.5"
      :class="active ? 'text-success' : ''"
    />
    {{ active ? 'Signing in over JMAP.' : 'This server also speaks JMAP.' }}
    <UButton
      v-if="!active || canSwitch"
      :label="active ? 'Use IMAP instead' : 'Use JMAP'"
      variant="link"
      color="neutral"
      size="xs"
      class="p-0 underline"
      @click="emit('choose', !active)"
    />
  </p>
</template>
