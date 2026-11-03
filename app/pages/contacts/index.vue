<script setup lang="ts">
useSeoMeta({ title: 'Contacts' })

const { account } = useShell()
const { selected, selectedId, editorOpen, editing, submit, books } = useContactsPage()

const isMobile = useMediaQuery('(max-width: 1023px)')
const detailOpen = computed({
  get: () => !!selected.value,
  set: (open) => {
    if (!open) selectedId.value = undefined
  }
})
</script>

<template>
  <div class="relative flex-1 flex min-w-0">
    <ServiceNotConnected
      v-if="!account?.hasContacts"
      class="flex-1"
    />

    <template v-else>
      <ContactsList class="w-full lg:w-80 xl:w-96 shrink-0 lg:border-e border-default" />

      <template v-if="!isMobile">
        <ContactsDetail
          v-if="selected"
          :contact="selected"
          class="flex-1"
        />
        <UEmpty
          v-else
          icon="i-lucide-contact"
          title="No contact selected"
          description="Pick someone from the list to see their details."
          variant="naked"
          class="flex-1"
        />
      </template>

      <USlideover
        v-else
        v-model:open="detailOpen"
        side="right"
      >
        <template #content>
          <ContactsDetail
            v-if="selected"
            :contact="selected"
            class="h-full"
          />
        </template>
      </USlideover>

      <ContactsEditor
        v-model:open="editorOpen"
        :contact="editing"
        :books="books"
        @save="submit"
      />
    </template>
  </div>
</template>
