<script setup lang="ts">
defineProps<{
  securityItems: { label: string, value: string }[]
}>()

const incoming = defineModel<IncomingSettings>('incoming', { required: true })

const protocols = [
  { label: 'IMAP', value: 'imap' },
  { label: 'POP3', value: 'pop3' },
  { label: 'JMAP', value: 'jmap' }
]
</script>

<template>
  <div class="flex flex-col gap-5">
    <AuthServerFields
      v-model:server="incoming"
      title="Incoming mail"
      :security-items="securityItems"
    >
      <UTabs
        v-model="incoming.protocol"
        :items="protocols"
        :content="false"
        color="neutral"
        size="xs"
        class="w-44"
      />
    </AuthServerFields>

    <AuthJmapFields
      v-if="incoming.protocol === 'jmap'"
      v-model:incoming="incoming"
    />
  </div>
</template>
