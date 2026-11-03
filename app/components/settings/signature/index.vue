<script setup lang="ts">
const { settings, save } = useSettings()

const state = reactive({ signature: '', signatureMode: 'rich' as UserSettings['signatureMode'], signatureOnReplies: true })
// The editor remounts when the saved signature arrives
const version = ref(0)
watch(settings, (value) => {
  Object.assign(state, { signature: value.signature, signatureMode: value.signatureMode, signatureOnReplies: value.signatureOnReplies })
  version.value++
}, { immediate: true })

const MODES = [
  { label: 'Write it', value: 'rich', icon: 'i-lucide-pen-line' },
  { label: 'Paste HTML', value: 'html', icon: 'i-lucide-code-xml' }
]

const saving = ref(false)
async function submit() {
  saving.value = true
  await save({ ...state }, 'Signature saved')
  saving.value = false
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <UTabs
      v-model="state.signatureMode"
      :items="MODES"
      :content="false"
      color="neutral"
      size="sm"
      class="w-72"
    />

    <div
      v-if="state.signatureMode === 'rich'"
      class="rounded-lg ring ring-default overflow-hidden"
    >
      <UEditor
        :key="version"
        v-slot="{ editor }"
        v-model="state.signature"
        content-type="html"
        placeholder="Ada Lovelace&#10;Analyst, Engine Co."
        class="flex flex-col"
        :ui="{ content: 'order-2 px-4 py-3 min-h-32', base: 'px-0 sm:px-0 text-sm leading-6 [&_p]:leading-6 *:my-0' }"
      >
        <div class="order-1 px-2 py-1.5 border-b border-default bg-elevated/40">
          <MailComposerToolbar :editor="editor" />
        </div>
      </UEditor>
    </div>

    <SettingsSignatureHtml
      v-else
      v-model="state.signature"
    />

    <USwitch
      v-model="state.signatureOnReplies"
      label="Add it to replies and forwards too"
    />

    <UButton
      label="Save signature"
      :loading="saving"
      class="self-start"
      @click="submit"
    />
  </div>
</template>
