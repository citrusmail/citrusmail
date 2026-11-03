<script setup lang="ts">
defineProps<{
  saved: boolean
  saving: boolean
}>()

const apiKey = defineModel<string>('apiKey', { required: true })
const model = defineModel<string>('model', { required: true })

const emit = defineEmits<{
  submit: []
  remove: []
}>()
</script>

<template>
  <form
    class="px-4 pb-4 grid gap-3 sm:grid-cols-[1fr_12rem_auto] items-end"
    @submit.prevent="emit('submit')"
  >
    <UFormField :label="saved ? 'New key (leave empty to keep)' : 'API key'">
      <UInput
        v-model="apiKey"
        type="password"
        autocomplete="off"
        spellcheck="false"
      />
    </UFormField>
    <UFormField label="Model">
      <UInput
        v-model="model"
        spellcheck="false"
      />
    </UFormField>
    <div class="flex gap-1">
      <UButton
        type="submit"
        label="Save"
        :loading="saving"
      />
      <UTooltip
        v-if="saved"
        text="Remove key"
      >
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          aria-label="Remove key"
          @click="emit('remove')"
        />
      </UTooltip>
    </div>
  </form>
</template>
