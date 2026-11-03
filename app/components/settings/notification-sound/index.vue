<script setup lang="ts">
const { prefs, set } = useNotificationSettings()

function choose(sound: NotificationSound) {
  set({ sound })
  playSound(sound, prefs.value.volume)
}

const setVolume = useDebounceFn((volume: number) => {
  set({ volume })
  playSound(prefs.value.sound, volume)
}, 250)
</script>

<template>
  <fieldset class="flex flex-col gap-5">
    <legend class="text-sm font-semibold text-highlighted mb-3">
      Sound
    </legend>
    <div class="flex flex-wrap gap-2">
      <UButton
        v-for="sound in SOUNDS"
        :key="sound.value"
        :label="sound.label"
        :icon="sound.value === 'none' ? 'i-lucide-volume-x' : prefs.sound === sound.value ? 'i-lucide-volume-2' : undefined"
        :color="prefs.sound === sound.value ? 'primary' : 'neutral'"
        :variant="prefs.sound === sound.value ? 'soft' : 'outline'"
        size="sm"
        :aria-pressed="prefs.sound === sound.value"
        @click="choose(sound.value)"
      />
    </div>
    <UFormField
      v-if="prefs.sound !== 'none'"
      label="Volume"
    >
      <USlider
        :model-value="prefs.volume"
        :min="5"
        :max="100"
        :step="5"
        class="max-w-xs mt-2"
        @update:model-value="setVolume($event as number)"
      />
    </UFormField>

    <UFormField
      label="Quiet hours"
      description="No sounds or banners between these times. Mail still arrives."
    >
      <div class="flex items-center gap-2 mt-2">
        <UInput
          type="time"
          :model-value="prefs.quietFrom"
          aria-label="Quiet from"
          class="w-32"
          @change="set({ quietFrom: ($event.target as HTMLInputElement).value })"
        />
        <span class="text-sm text-muted">to</span>
        <UInput
          type="time"
          :model-value="prefs.quietTo"
          aria-label="Quiet until"
          class="w-32"
          @change="set({ quietTo: ($event.target as HTMLInputElement).value })"
        />
        <UButton
          v-if="prefs.quietFrom || prefs.quietTo"
          label="Clear"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="set({ quietFrom: '', quietTo: '' })"
        />
      </div>
    </UFormField>
  </fieldset>
</template>
