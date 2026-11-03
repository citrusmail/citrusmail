<script setup lang="ts">
const { prefs, set, setBanners, setPush, desktop, pushSupported, permission } = useNotificationSettings()
</script>

<template>
  <fieldset class="flex flex-col gap-4">
    <legend class="text-sm font-semibold text-highlighted mb-3">
      How
    </legend>
    <USwitch
      :model-value="prefs.banners && permission === 'granted'"
      label="Banners"
      :description="permission === 'denied' ? 'Blocked for this site. Allow notifications in your browser’s site settings to use them.' : desktop ? 'In your system’s notification center, also with the window closed, as long as the app is running.' : 'In your system’s notification center, when CitrusMail isn’t in front.'"
      @update:model-value="setBanners($event)"
    />
    <USwitch
      :model-value="prefs.inApp"
      label="In the app"
      description="A small card at the bottom of the window while you’re using it."
      @update:model-value="set({ inApp: $event })"
    />
    <USwitch
      v-if="!desktop"
      :model-value="prefs.push"
      label="Push to this browser"
      :description="pushSupported ? 'Banners even when CitrusMail is closed. This server checks your mail for you to send them.' : 'This browser can’t receive push here. It needs a secure (https) address.'"
      :disabled="!pushSupported"
      @update:model-value="setPush($event)"
    />
    <USwitch
      :model-value="prefs.preview"
      label="Show who it’s from and the subject"
      description="Turn off to only say there’s new mail, for when others can see your screen."
      @update:model-value="set({ preview: $event })"
    />
  </fieldset>
</template>
