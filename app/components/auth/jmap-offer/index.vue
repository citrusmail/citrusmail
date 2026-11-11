<script setup lang="ts">
// Discovery found a JMAP server for this address: offer it instead of IMAP
defineProps<{
  active: boolean
  /** The server wants an API token rather than a password */
  token?: boolean
}>()

const emit = defineEmits<{
  use: []
}>()
</script>

<template>
  <p class="-mt-2 text-xs text-muted flex items-center gap-1.5">
    <UIcon
      name="i-lucide-zap"
      class="size-3.5"
      :class="active ? 'text-success' : ''"
    />
    <template v-if="active">
      Signing in over JMAP{{ token ? ' with an API token, in place of the password' : '' }}.
    </template>
    <template v-else>
      This server also speaks JMAP.
      <UButton
        label="Use JMAP"
        variant="link"
        color="neutral"
        size="xs"
        class="p-0 underline"
        @click="emit('use')"
      />
    </template>
  </p>
</template>
