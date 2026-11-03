<script setup lang="ts">
const props = defineProps<{
  item: AiStatus['providers'][number]
  active: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  save: [key: string, model: string]
  use: []
  remove: []
}>()

const editing = ref(false)
const key = ref('')
const model = ref(props.item.model)

watch(() => props.item.saved, () => {
  editing.value = false
  key.value = ''
})

function submit() {
  if (!props.item.saved && !key.value.trim()) return
  emit('save', key.value.trim(), model.value.trim())
}
</script>

<template>
  <li
    class="rounded-(--ui-radius) ring transition-colors"
    :class="active ? 'ring-(--lb-ai) bg-(--lb-ai-bg)' : 'ring-default'"
  >
    <div class="flex items-center gap-3 px-4 py-3">
      <span class="grid place-items-center size-9 shrink-0 rounded-lg bg-elevated ring ring-default">
        <UIcon
          :name="AI_LOGOS[item.provider].icon"
          :class="AI_LOGOS[item.provider].color"
          class="size-5"
          aria-hidden="true"
        />
      </span>
      <div class="flex-1 min-w-0">
        <p class="font-medium text-highlighted">
          {{ item.label }}
        </p>
        <p class="text-sm text-muted truncate">
          {{ item.saved ? `Key saved, using ${item.model}` : `Get a key at ${item.hint}` }}
        </p>
      </div>
      <UBadge
        v-if="active"
        label="In use"
        icon="i-lucide-sparkles"
        class="text-(--lb-ai) bg-[color-mix(in_oklab,var(--lb-ai)_14%,transparent)]"
      />
      <UButton
        v-else-if="item.saved"
        label="Use"
        color="neutral"
        variant="outline"
        size="sm"
        @click="emit('use')"
      />
      <UButton
        :label="item.saved ? 'Change' : 'Add key'"
        color="neutral"
        :variant="item.saved ? 'ghost' : 'outline'"
        size="sm"
        :aria-expanded="editing"
        @click="editing = !editing"
      />
    </div>

    <div
      class="lb-expand"
      :data-open="editing || undefined"
      :inert="!editing"
    >
      <SettingsAiKeyForm
        v-model:model="model"
        v-model:api-key="key"
        :saved="item.saved"
        :saving="saving"
        @submit="submit"
        @remove="emit('remove')"
      />
    </div>
  </li>
</template>
