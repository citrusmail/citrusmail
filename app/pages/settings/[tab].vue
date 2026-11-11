<script setup lang="ts">
const route = useRoute()

const TABS = {
  profile: { title: 'Profile', description: 'How you appear to the people you write to.' },
  signature: { title: 'Signature', description: 'Added under the messages you write.' },
  appearance: { title: 'Appearance', description: 'How CitrusMail looks for you.' },
  reading: { title: 'Reading', description: 'How messages open, and when pictures from the web load in them.' },
  notifications: { title: 'Notifications', description: 'When and how CitrusMail tells you about new mail.' },
  senders: { title: 'Senders', description: 'People and domains that always reach your Inbox, and those that never do.' },
  rules: { title: 'Rules', description: 'Sort incoming mail into folders on its own.' },
  tracking: { title: 'Tracking', description: 'Find out when messages you send are delivered and opened.' },
  ai: { title: 'AI', description: 'Bring your own key to draft replies, summarize long messages and ask questions of all your mail.' },
  about: { title: 'About', description: 'The app, its version and where its code is.' }
} as const

const tab = computed(() => (route.params.tab as string) in TABS ? route.params.tab as keyof typeof TABS : 'profile')
useSeoMeta({ title: () => `${TABS[tab.value].title} · Settings` })
</script>

<template>
  <SettingsPage
    :title="TABS[tab].title"
    :description="TABS[tab].description"
  >
    <SettingsProfile v-if="tab === 'profile'" />
    <SettingsSignature v-else-if="tab === 'signature'" />
    <SettingsAppearance v-else-if="tab === 'appearance'" />
    <SettingsReading v-else-if="tab === 'reading'" />
    <SettingsNotifications v-else-if="tab === 'notifications'" />
    <SettingsSenders v-else-if="tab === 'senders'" />
    <SettingsAi v-else-if="tab === 'ai'" />
    <SettingsTracking v-else-if="tab === 'tracking'" />
    <SettingsAbout v-else-if="tab === 'about'" />
    <SettingsRules v-else />
  </SettingsPage>
</template>
