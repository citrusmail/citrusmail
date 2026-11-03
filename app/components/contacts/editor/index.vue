<script setup lang="ts">
const props = defineProps<{
  contact: Contact | null
  books: ContactBook[]
}>()

const emit = defineEmits<{
  save: [contact: Contact]
}>()

const open = defineModel<boolean>('open', { required: true })

const state = ref<Contact>({ id: '', bookId: '', name: '', emails: [''], phones: [] })
const saving = ref(false)

watch(() => props.contact, (contact) => {
  if (contact) state.value = { ...contact, emails: [...contact.emails], phones: [...contact.phones] }
}, { immediate: true })

async function onSubmit() {
  saving.value = true
  emit('save', state.value)
  // The page closes the slideover once the save lands
  setTimeout(() => (saving.value = false), 600)
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="state.id ? 'Edit contact' : 'New contact'"
    :ui="{ body: 'flex flex-col gap-5', footer: 'justify-end gap-2' }"
  >
    <template #body>
      <UForm
        id="contact-form"
        :state="state"
        class="flex flex-col gap-5"
        @submit="onSubmit"
      >
        <UFormField
          label="Name"
          name="name"
          required
        >
          <UInput
            v-model="state.name"
            autofocus
            required
          />
        </UFormField>

        <ContactsListField
          v-model="state.emails"
          label="Email"
          type="email"
          add-label="Add email"
        />
        <ContactsListField
          v-model="state.phones"
          label="Phone"
          type="tel"
          add-label="Add phone"
        />

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Company">
            <UInput v-model="state.company" />
          </UFormField>
          <UFormField label="Job title">
            <UInput v-model="state.title" />
          </UFormField>
        </div>

        <UFormField label="Birthday">
          <UInput
            v-model="state.birthday"
            type="date"
          />
        </UFormField>

        <UFormField label="Note">
          <UTextarea
            v-model="state.note"
            autoresize
            :rows="3"
          />
        </UFormField>

        <UFormField
          v-if="books.length > 1"
          label="Address book"
        >
          <USelect
            v-model="state.bookId"
            :items="books.map(book => ({ label: book.name, value: book.id }))"
            :disabled="!!state.id"
          />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <UButton
        label="Cancel"
        color="neutral"
        variant="ghost"
        @click="open = false"
      />
      <UButton
        type="submit"
        form="contact-form"
        :label="state.id ? 'Save' : 'Add contact'"
        :loading="saving"
      />
    </template>
  </USlideover>
</template>
