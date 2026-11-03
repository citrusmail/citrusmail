<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

defineProps<{
  collapsed?: boolean
}>()

const { account } = useShell()
const appConfig = useAppConfig()

const imap = computed(() => account.value?.protocol !== 'pop3')

const items = computed<NavigationMenuItem[]>(() => [
  { label: 'Profile', icon: 'i-lucide-circle-user-round', to: '/settings/profile' },
  { label: 'Signature', icon: 'i-lucide-signature', to: '/settings/signature' },
  ...(appConfig.citrusmail.allowAppearance ? [{ label: 'Appearance', icon: 'i-lucide-palette', to: '/settings/appearance' }] : []),
  { label: 'Reading', icon: 'i-lucide-book-open', to: '/settings/reading' },
  { label: 'Notifications', icon: 'i-lucide-bell', to: '/settings/notifications' },
  // POP3 has no folders to file into
  ...(imap.value ? [{ label: 'Senders', icon: 'i-lucide-shield-check', to: '/settings/senders' }] : []),
  ...(imap.value ? [{ label: 'Rules', icon: 'i-lucide-list-filter', to: '/settings/rules' }] : []),
  { label: 'Tracking', icon: 'i-lucide-mail-check', to: '/settings/tracking' },
  { label: 'AI', icon: 'i-lucide-sparkles', to: '/settings/ai' }
])
</script>

<template>
  <p
    v-if="!collapsed"
    class="px-2.5 pb-1 text-xs font-medium text-muted"
  >
    Settings
  </p>
  <UNavigationMenu
    :items="items"
    orientation="vertical"
    :collapsed="collapsed"
    :tooltip="{ content: { side: 'right' } }"
  />
</template>
