<script setup lang="ts">
// JMAP's extras: where the session is, when it isn't /.well-known/jmap on
// the host, and whether the password is sent as Basic auth or a bearer token
const incoming = defineModel<IncomingSettings>('incoming', { required: true })

const authItems = [
  { label: 'Password or app password', value: 'basic' },
  { label: 'API token (Bearer)', value: 'bearer' }
]

const url = computed({
  get: () => incoming.value.url ?? '',
  set: (value: string) => {
    incoming.value.url = value.trim() || undefined
    // The host, port and security above follow the URL, for the summary and SMTP fallback
    try {
      const parsed = new URL(value.trim())
      const secure = parsed.protocol === 'https:'
      Object.assign(incoming.value, { host: parsed.hostname.replace(/^\[|\]$/g, ''), port: Number(parsed.port) || (secure ? 443 : 80), security: secure ? 'tls' : 'none' })
    } catch {
      // Still being typed
    }
  }
})

const auth = computed({
  get: () => incoming.value.auth ?? 'basic',
  set: (value: 'basic' | 'bearer') => {
    incoming.value.auth = value
  }
})
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="mb-2 text-sm font-medium text-highlighted">
      JMAP
    </legend>
    <UInput
      v-model="url"
      type="url"
      placeholder="https://mail.example.com/jmap/session"
      aria-label="JMAP session URL"
    />
    <USelect
      v-model="auth"
      :items="authItems"
      aria-label="How to sign in"
    />
    <p class="text-xs text-muted text-pretty">
      Leave the URL empty to use /.well-known/jmap on the server above. When the server can send mail itself, the Outgoing settings are only a fallback.
    </p>
  </fieldset>
</template>
