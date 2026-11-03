<script setup lang="ts">
const { lists, save, allow, block, remove } = useSenders()

const ACTIONS = [
  { label: 'Junk', value: 'junk' },
  { label: 'Trash', value: 'trash' }
]

function setAction(value: string) {
  save({ ...lists.value, blockAction: value as SenderLists['blockAction'] }, `Blocked mail goes to ${value === 'trash' ? 'Trash' : 'Junk'}`)
}
</script>

<template>
  <div class="flex flex-col gap-10">
    <SettingsSenderList
      label="Allowed"
      description="Never sent to Junk, and their pictures load on their own. Allow a whole domain by starting with @."
      :entries="lists.allowed"
      empty="No one yet. Use the menu on a sender’s name in a message to allow them."
      icon="i-lucide-shield-check"
      @add="allow"
      @remove="remove"
    />

    <SettingsSenderList
      label="Blocked"
      description="Their mail skips your Inbox, including what’s already there."
      :entries="lists.blocked"
      empty="No one blocked."
      icon="i-lucide-ban"
      @add="block"
      @remove="remove"
    />

    <UFormField label="Blocked mail goes to">
      <UTabs
        :model-value="lists.blockAction"
        :items="ACTIONS"
        :content="false"
        color="neutral"
        size="sm"
        class="w-56 mt-1"
        @update:model-value="setAction(String($event))"
      />
    </UFormField>
  </div>
</template>
