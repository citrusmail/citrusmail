<script setup lang="ts">
// A JMAP server is one field: a host, a URL with a port, or the session URL.
// Whether the password is a password or an API token is found at sign-in
const incoming = defineModel<IncomingSettings>('incoming', { required: true })

/** What was typed, kept while it isn't a whole address yet */
const draft = ref<string>()

const text = computed({
  get: () => draft.value ?? jmapServerText(incoming.value),
  set: (value: string) => {
    draft.value = value
    const parsed = value.trim() ? jmapIncoming(value) : { host: '', port: 443, security: 'tls' as const, url: undefined }
    if (!parsed) return
    Object.assign(incoming.value, { host: parsed.host, port: parsed.port, security: parsed.security, url: parsed.url })
  }
})
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="w-full flex items-center justify-between mb-2 text-sm font-medium text-highlighted">
      Incoming mail
      <slot />
    </legend>
    <UInput
      v-model="text"
      placeholder="mail.example.com"
      aria-label="JMAP server"
    />
    <p class="text-xs text-muted text-pretty">
      The server name, or its session URL (Fastmail: https://api.fastmail.com/jmap/session). Use your password, an app password or an API token.
    </p>
  </fieldset>
</template>
