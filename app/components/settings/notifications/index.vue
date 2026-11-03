<script setup lang="ts">
const { prefs, set } = useNotificationSettings()
</script>

<template>
  <div class="flex flex-col gap-10 max-w-xl">
    <USwitch
      :model-value="prefs.enabled"
      label="Notify me about new mail"
      description="While CitrusMail is open in any tab, it checks every minute or so."
      @update:model-value="set({ enabled: $event })"
    />

    <div
      class="flex flex-col gap-10 transition-opacity"
      :class="!prefs.enabled && 'opacity-50 pointer-events-none'"
      :inert="!prefs.enabled"
    >
      <SettingsNotificationDelivery />
      <SettingsNotificationSound />
      <SettingsNotificationMailboxes />
    </div>
  </div>
</template>
