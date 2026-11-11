<script setup lang="ts">
import type { SignInForm } from '~/composables/useSignIn'

const brand = useBrand()

const form = defineModel<SignInForm>('form', { required: true })

const emit = defineEmits<{
  touch: []
}>()

const open = defineModel<boolean>('open', { required: true })

const securityItems = [
  { label: 'SSL/TLS', value: 'tls' },
  { label: 'STARTTLS', value: 'starttls' },
  { label: 'None', value: 'none' }
]

// One tab per thing the address connects to, so the dialog stays short
const TABS = [
  { label: 'Account', value: 'account', icon: 'i-lucide-circle-user-round', slot: 'account' as const },
  { label: 'Incoming', value: 'incoming', icon: 'i-lucide-inbox', slot: 'incoming' as const },
  { label: 'Outgoing', value: 'outgoing', icon: 'i-lucide-send', slot: 'outgoing' as const },
  { label: 'Calendar & contacts', value: 'dav', icon: 'i-lucide-calendar-days', slot: 'dav' as const }
]
const tab = ref('incoming')

useServerPorts(form)
</script>

<template>
  <UModal
    v-model:open="open"
    title="Server settings"
    :description="`${brand.name} fills these in from your address. Change them only if your provider gave you different ones.`"
    :ui="{ content: 'sm:max-w-xl', body: 'p-0 sm:p-0', footer: 'justify-end' }"
  >
    <template #body>
      <UTabs
        v-model="tab"
        :items="TABS"
        variant="link"
        color="neutral"
        size="sm"
        class="gap-0"
        :ui="{ list: 'pt-2 px-4 sm:px-6 border-b border-default', trigger: 'pb-2.5 data-[state=active]:text-highlighted', content: 'px-4 sm:px-6 py-5 min-h-72' }"
        @input="emit('touch')"
        @change="emit('touch')"
      >
        <template #account>
          <AuthAccountFields v-model:form="form" />
        </template>

        <template #incoming>
          <AuthIncomingFields
            v-model:incoming="form.incoming"
            :security-items="securityItems"
          />
        </template>

        <template #outgoing>
          <AuthServerFields
            v-model:server="form.outgoing"
            title="Outgoing mail (SMTP)"
            :security-items="securityItems"
          />
        </template>

        <template #dav>
          <AuthDavFields v-model:form="form" />
        </template>
      </UTabs>
    </template>

    <template #footer>
      <UButton
        label="Done"
        @click="open = false"
      />
    </template>
  </UModal>
</template>
