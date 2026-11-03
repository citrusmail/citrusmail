<script setup lang="ts">
// Shown while a mailbox has no calendar or address book. It looks on the
// mail server first (loading the session fills the address in when it's
// there), so most people go straight to their events and never see the part
// that asks for an address
const props = defineProps<{
  feature?: 'contacts' | 'calendar'
}>()

const { fetch } = useUserSession()
const { account } = useShell()
const looking = ref(true)
// With the mail server set by the environment, Settings has no address fields
const locked = !!(useRuntimeConfig().public.mail as { locked?: boolean } | undefined)?.locked

const calendar = computed(() => props.feature === 'calendar')
const found = computed(() => calendar.value ? account.value?.hasCalendar : account.value?.hasContacts)

async function look() {
  looking.value = true
  try {
    await fetch()
    // The page fetched before there was anywhere to fetch from
    if (found.value) await refreshNuxtData()
  } finally {
    looking.value = false
  }
}

onMounted(look)
</script>

<template>
  <div class="flex items-center justify-center p-6">
    <UEmpty
      v-if="looking"
      icon="i-lucide-loader-circle"
      :title="calendar ? 'Looking for your calendar' : 'Looking for your contacts'"
      description="Checking your mail server. This takes a few seconds."
      :ui="{ avatar: 'shrink-0 mb-2 animate-spin motion-reduce:animate-none' }"
      variant="naked"
    />
    <UEmpty
      v-else
      :icon="calendar ? 'i-lucide-calendar-off' : 'i-lucide-contact'"
      :title="calendar ? 'No calendar found' : 'No address book found'"
      :description="calendar
        ? `Your mail server doesn’t seem to offer a calendar, and not every provider does.${locked ? '' : ' If yours gives you a CalDAV address, add it in Settings.'}`
        : `Your mail server doesn’t seem to offer an address book, and not every provider does.${locked ? '' : ' If yours gives you a CardDAV address, add it in Settings.'}`"
      :actions="[
        { label: 'Look again', icon: 'i-lucide-refresh-cw', color: 'neutral', variant: 'subtle', onClick: look },
        ...(locked ? [] : [{ label: 'Add an address', icon: 'i-lucide-settings', color: 'neutral' as const, variant: 'ghost' as const, to: '/settings/profile' }])
      ]"
      variant="naked"
    />
  </div>
</template>
