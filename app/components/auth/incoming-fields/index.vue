<script setup lang="ts">
defineProps<{
  securityItems: { label: string, value: string }[]
}>()

const incoming = defineModel<IncomingSettings>('incoming', { required: true })

const tabs = {
  items: [
    { label: 'IMAP', value: 'imap' },
    { label: 'POP3', value: 'pop3' },
    { label: 'JMAP', value: 'jmap' }
  ],
  content: false,
  color: 'neutral' as const,
  size: 'xs' as const,
  class: 'w-44'
}
</script>

<template>
  <!-- JMAP is one field; IMAP and POP3 have host, port and security -->
  <AuthJmapFields
    v-if="incoming.protocol === 'jmap'"
    v-model:incoming="incoming"
  >
    <UTabs
      v-model="incoming.protocol"
      v-bind="tabs"
    />
  </AuthJmapFields>
  <AuthServerFields
    v-else
    v-model:server="incoming"
    title="Incoming mail"
    :security-items="securityItems"
  >
    <UTabs
      v-model="incoming.protocol"
      v-bind="tabs"
    />
  </AuthServerFields>
</template>
