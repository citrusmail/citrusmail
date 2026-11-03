<script setup lang="ts">
defineProps<{
  feature?: 'contacts' | 'calendar'
}>()

const accountOpen = ref(false)
</script>

<template>
  <div class="flex items-center justify-center p-6">
    <UEmpty
      :icon="feature === 'calendar' ? 'i-lucide-calendar-off' : 'i-lucide-contact'"
      :title="feature === 'calendar' ? 'No calendar connected' : 'No address book connected'"
      :description="feature === 'calendar'
        ? 'Your mail provider didn’t share a CalDAV address. Add it in account settings to see your events here.'
        : 'Your mail provider didn’t share a CardDAV address. Add it in account settings to see your contacts here.'"
      :actions="[{ label: 'Open account settings', icon: 'i-lucide-settings', color: 'neutral', variant: 'subtle', onClick: () => { accountOpen = true } }]"
      variant="naked"
    />
    <AccountSettings v-model:open="accountOpen" />
  </div>
</template>
