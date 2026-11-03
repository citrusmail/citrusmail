<script setup lang="ts">
// No markup: this watches for new mail while the app is open, and renews
// this browser's push subscription once settings have loaded
useNewMail()
const { prefs, renewPush } = useNotificationSettings()
let renewed = false
watch(() => prefs.value.push, (on) => {
  if (!on || renewed) return
  renewed = true
  renewPush()
}, { immediate: true })
</script>

<template>
  <span class="hidden" />
</template>
