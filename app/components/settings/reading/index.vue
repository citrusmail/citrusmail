<script setup lang="ts">
const { settings, save } = useSettings()
const { view } = useMailLayout()

const VIEWS = [
  { label: 'List and message', value: 'split', icon: 'i-lucide-columns-2' },
  { label: 'List only', value: 'list', icon: 'i-lucide-rows-3' }
]

const REMOTE = [
  { value: 'allowed', label: 'From senders you allow', description: 'Mail from people on your allow list shows its pictures. For anyone else, one click shows them.' },
  { value: 'ask', label: 'Ask every time', description: 'Pictures stay hidden until you choose to show them. Senders can’t tell you’ve opened their mail.' },
  { value: 'always', label: 'Always', description: 'Every message shows its pictures. Senders that track opens will know when you read their mail.' }
]

const { ready } = useAi()
const languages = Object.entries(LANGUAGES).map(([value, item]) => ({ value, label: item.name, description: item.native }))
const language = computed({
  get: () => settings.value.language || 'en',
  set: (value: string) => save({ language: value }, `Messages will be translated into ${languageName(value)}`)
})

const remote = computed({
  get: () => settings.value.remoteImages ?? 'allowed',
  set: (value: RemoteImages) => save({ remoteImages: value }, 'Saved')
})
</script>

<template>
  <div class="flex flex-col gap-8">
    <UFormField
      label="Layout"
      description="With the list only, a message opens over the list and Escape goes back. Shift+V switches between them."
    >
      <UTabs
        v-model="view"
        :items="VIEWS"
        :content="false"
        color="neutral"
        size="sm"
        class="w-96 max-w-full mt-1"
      />
    </UFormField>

    <UFormField
      label="Your language"
      :description="ready ? 'AI Translate offers to translate messages written in anything else, and translates them into this.' : 'AI Translate uses this once you add a key in Settings → AI.'"
    >
      <USelectMenu
        v-model="language"
        :items="languages"
        value-key="value"
        class="w-64 mt-1"
      />
    </UFormField>

    <UFormField
      label="Show pictures from the web"
      description="Pictures in a message can be loaded from the sender’s server, which tells them you opened it."
    >
      <URadioGroup
        v-model="remote"
        :items="REMOTE"
        variant="card"
        class="mt-2 max-w-xl"
      />
    </UFormField>
  </div>
</template>
