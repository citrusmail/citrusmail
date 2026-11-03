<script setup lang="ts">
const appConfig = useAppConfig()
const colorMode = useColorMode()
const { $appearance } = useNuxtApp()
const { save } = useSettings()

const theme = appConfig.letterbox.theme
const fonts = computed(() => appConfig.letterbox.fonts.map(font => ({ ...font, style: { fontFamily: font.value } })))

// Changes show at once and are saved a moment later
function set<K extends keyof Appearance>(key: K, value: Appearance[K]) {
  $appearance.value = { ...$appearance.value, [key]: value }
  persist()
}
const persist = useDebounceFn(() => save({ appearance: { ...$appearance.value } }, 'Appearance saved'), 800)

function reset() {
  $appearance.value = {}
  save({ appearance: {} }, 'Back to the default look')
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <UFormField label="Theme">
      <UTabs
        v-model="colorMode.preference"
        :items="APPEARANCE_MODES"
        :content="false"
        color="neutral"
        size="sm"
        class="w-80"
      />
    </UFormField>

    <UFormField
      label="Accent"
      description="Buttons, links, the unread dot and the selected message."
    >
      <SettingsAccentPicker
        :model-value="$appearance.primary"
        class="mt-1"
        @update:model-value="set('primary', $event)"
      />
    </UFormField>

    <UFormField label="Font">
      <USelect
        :model-value="$appearance.font ?? theme.font"
        :items="fonts"
        class="w-72"
        @update:model-value="set('font', $event as string)"
      >
        <template #item-label="{ item }">
          <span :style="item.style">{{ item.label }}</span>
        </template>
      </USelect>
    </UFormField>

    <UFormField label="Text size">
      <UTabs
        :model-value="$appearance.fontSize ?? theme.fontSize"
        :items="APPEARANCE_SIZES"
        :content="false"
        color="neutral"
        size="sm"
        class="w-80"
        @update:model-value="set('fontSize', $event as string)"
      />
    </UFormField>

    <UFormField label="Corners">
      <UTabs
        :model-value="$appearance.radius ?? theme.radius"
        :items="APPEARANCE_CORNERS"
        :content="false"
        color="neutral"
        size="sm"
        class="w-80"
        @update:model-value="set('radius', $event as string)"
      />
    </UFormField>

    <UFormField
      label="Background"
      description="A picture of your own behind the app. The page you read on stays solid."
    >
      <SettingsBackground class="mt-2" />
    </UFormField>

    <UButton
      label="Reset to default"
      icon="i-lucide-rotate-ccw"
      color="neutral"
      variant="outline"
      class="self-start"
      @click="reset"
    />
  </div>
</template>
