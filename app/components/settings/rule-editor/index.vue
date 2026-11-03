<script setup lang="ts">
const props = defineProps<{
  rule?: MailRule
  /** A folder to start with, from "Filter mail into this folder" */
  folder?: string
}>()

const emit = defineEmits<{
  close: [rule?: RuleInput]
}>()

const { folders } = useMail()

const state = reactive<RuleInput>({
  id: props.rule?.id ?? crypto.randomUUID(),
  enabled: props.rule?.enabled ?? true,
  match: props.rule?.match ?? 'all',
  conditions: props.rule ? props.rule.conditions.map(condition => ({ ...condition })) : [{ field: 'from', value: '' }],
  folder: props.rule?.folder ?? props.folder ?? '',
  markRead: props.rule?.markRead ?? false,
  createFolder: false,
  applyToExisting: !props.rule
})

// Any folder but the Inbox itself; typing a new name creates it on save
const folderItems = computed(() => [
  ...folders.value.filter(folder => folder.role !== 'inbox').map(folder => ({ label: folder.name, value: folder.path, icon: folderIcon(folder) })),
  ...(state.createFolder && state.folder ? [{ label: state.folder, value: state.folder, icon: 'i-lucide-folder-plus' }] : [])
])

function createFolder(name: string) {
  state.createFolder = true
  state.folder = name.trim()
}

const MATCH = [{ label: 'all', value: 'all' }, { label: 'any', value: 'any' }]

function validate() {
  if (state.conditions.some(condition => !condition.value.trim())) return [{ name: 'conditions', message: 'Fill in every condition' }]
  if (!state.folder) return [{ name: 'folder', message: 'Choose a folder' }]
  return []
}
</script>

<template>
  <UModal
    :title="rule ? 'Edit rule' : 'New rule'"
    :ui="{ content: 'sm:max-w-xl', footer: 'justify-end gap-2' }"
    @update:open="emit('close')"
  >
    <template #body>
      <UForm
        id="rule-form"
        :state="state"
        :validate="validate"
        class="flex flex-col gap-6"
        @submit="emit('close', { ...state, folder: state.folder })"
      >
        <UFormField name="conditions">
          <template #label>
            <span class="flex items-center gap-2">
              When
              <USelect
                v-if="state.conditions.length > 1"
                v-model="state.match"
                :items="MATCH"
                size="xs"
                class="w-16"
              />
              <template v-else>a message</template>
              <span v-if="state.conditions.length > 1">of these match</span>
            </span>
          </template>
          <div class="flex flex-col gap-2">
            <SettingsRuleCondition
              v-for="(_, index) in state.conditions"
              :key="index"
              v-model="state.conditions[index]!"
              :removable="state.conditions.length > 1"
              @remove="state.conditions.splice(index, 1)"
            />
            <UButton
              label="Add condition"
              icon="i-lucide-plus"
              color="neutral"
              variant="link"
              size="sm"
              class="self-start px-0"
              @click="state.conditions.push({ field: 'from', value: '' })"
            />
          </div>
        </UFormField>

        <UFormField
          label="Move it to"
          name="folder"
        >
          <USelectMenu
            v-model="state.folder"
            :items="folderItems"
            value-key="value"
            create-item="always"
            placeholder="Choose or type a new folder"
            :search-input="{ placeholder: 'Find or name a folder' }"
            @create="createFolder"
          />
        </UFormField>

        <div class="flex flex-col gap-3">
          <UCheckbox
            v-model="state.markRead"
            label="Also mark it as read"
          />
          <UCheckbox
            v-if="!rule"
            v-model="state.applyToExisting"
            label="Move matching mail already in my Inbox"
          />
        </div>
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
        form="rule-form"
        :label="rule ? 'Save rule' : 'Add rule'"
      />
    </template>
  </UModal>
</template>
