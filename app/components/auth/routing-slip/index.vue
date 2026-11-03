<script setup lang="ts">
import type { SignInForm } from '~/composables/useSignIn'

const props = defineProps<{
  form: SignInForm
  discovery: DiscoveryResult | null
  discovering: boolean
  submitting: boolean
  failed: boolean
}>()

const PROVIDERS = [
  { name: 'Gmail', icon: 'i-simple-icons-gmail' },
  { name: 'iCloud', icon: 'i-simple-icons-icloud' },
  { name: 'Outlook', icon: 'i-simple-icons-microsoftoutlook' },
  { name: 'Yahoo', icon: 'i-simple-icons-yahoo' },
  { name: 'Proton', icon: 'i-simple-icons-protonmail' },
  { name: 'Zoho', icon: 'i-simple-icons-zoho' }
]

const domain = computed(() => isEmail(props.form.email) ? props.form.email.split('@')[1] : '')

// Each line of the slip is waiting, looking, found or not offered
type State = 'idle' | 'looking' | 'found' | 'missing'
const state = (value: string | undefined): State => {
  if (!domain.value) return 'idle'
  if (props.discovering) return 'looking'
  return value ? 'found' : 'missing'
}

function server(host: string, port: number) {
  return host ? `${host}:${port}` : undefined
}

function hostOf(url: string) {
  try {
    return new URL(url).host
  } catch {
    return url || undefined
  }
}

const rows = computed(() => [
  { label: 'Provider', icon: 'i-lucide-building-2', value: props.discovery?.provider ?? (props.discovery?.incoming ? 'Your own server' : undefined) },
  { label: `Incoming mail${props.form.incoming.host ? ` (${props.form.incoming.protocol.toUpperCase()})` : ''}`, icon: 'i-lucide-inbox', value: server(props.form.incoming.host, props.form.incoming.port) },
  { label: 'Outgoing mail (SMTP)', icon: 'i-lucide-send', value: server(props.form.outgoing.host, props.form.outgoing.port) },
  { label: 'Calendar', icon: 'i-lucide-calendar', value: hostOf(props.form.caldav), optional: true },
  { label: 'Contacts', icon: 'i-lucide-book-user', value: hostOf(props.form.carddav), optional: true }
].map(row => ({ ...row, state: state(row.value) })))

const status = computed(() => {
  if (props.submitting) return 'Signing in'
  if (props.failed) return 'Couldn’t sign in'
  if (!domain.value) return 'Waiting for your address'
  if (props.discovering) return `Looking up ${domain.value}`
  return props.form.incoming.host ? 'Ready to sign in' : 'Settings needed'
})
</script>

<template>
  <div class="w-full max-w-[28rem] flex flex-col gap-6">
    <div class="rounded-lg bg-default ring ring-default">
      <header class="flex items-center justify-between gap-4 px-5 h-14 border-b border-dashed border-accented">
        <div class="min-w-0">
          <p class="text-xs text-muted">
            Connection for
          </p>
          <p class="text-[15px] font-semibold text-highlighted truncate">
            {{ domain || 'your address' }}
          </p>
        </div>
        <UBadge
          :label="status"
          :color="failed ? 'error' : form.incoming.host && !discovering && domain ? 'primary' : 'neutral'"
          variant="subtle"
          class="rounded-full shrink-0"
        />
      </header>

      <ul class="divide-y divide-default">
        <AuthSlipRow
          v-for="row in rows"
          :key="row.label"
          v-bind="row"
        />
      </ul>
    </div>

    <div class="px-1">
      <p class="text-sm text-muted mb-3">
        Settings built in for
      </p>
      <div class="flex flex-wrap items-center gap-x-5 gap-y-3">
        <UTooltip
          v-for="provider in PROVIDERS"
          :key="provider.name"
          :text="provider.name"
        >
          <UIcon
            :name="provider.icon"
            class="size-5 text-dimmed"
            :class="discovery?.icon === provider.icon && 'text-highlighted'"
          />
        </UTooltip>
        <span class="text-sm text-muted">and any IMAP server</span>
      </div>
    </div>
  </div>
</template>
