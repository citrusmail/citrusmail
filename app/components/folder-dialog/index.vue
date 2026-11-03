<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  name?: string
  confirmLabel?: string
  /** Folders the new one can go inside; omitted when renaming */
  parents?: Folder[]
  parent?: string
}>(), {
  name: '',
  confirmLabel: 'Create folder',
  parents: undefined,
  parent: undefined
})

const emit = defineEmits<{
  close: [result?: { name: string, parent?: string }]
}>()

const state = reactive({ name: props.name, parent: props.parent ?? 'top' })

const parentItems = computed(() => [
  { label: 'Top level', value: 'top', icon: 'i-lucide-folders' },
  ...(props.parents ?? []).map(folder => ({ label: folder.name, value: folder.path, icon: folderIcon(folder) }))
])

function validate(value: typeof state) {
  const name = value.name.trim()
  if (!name) return [{ name: 'name', message: 'Give the folder a name' }]
  if (/[/\\*%]/.test(name)) return [{ name: 'name', message: 'Folder names can’t contain / \\ * or %' }]
  return []
}

function submit() {
  emit('close', { name: state.name.trim(), parent: state.parent === 'top' ? undefined : state.parent })
}
</script>

<template>
  <UModal
    :title="title"
    :ui="{ footer: 'justify-end gap-2' }"
    @update:open="emit('close')"
  >
    <template #body>
      <UForm
        id="folder-form"
        :state="state"
        :validate="validate"
        class="flex flex-col gap-4"
        @submit="submit"
      >
        <UFormField
          label="Name"
          name="name"
        >
          <UInput
            v-model="state.name"
            placeholder="Receipts"
            autofocus
          />
        </UFormField>

        <UFormField
          v-if="parents?.length"
          label="Inside"
        >
          <USelect
            v-model="state.parent"
            :items="parentItems"
          />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <UButton
        label="Cancel"
        color="neutral"
        variant="ghost"
        @click="emit('close')"
      />
      <UButton
        type="submit"
        form="folder-form"
        :label="confirmLabel"
      />
    </template>
  </UModal>
</template>
