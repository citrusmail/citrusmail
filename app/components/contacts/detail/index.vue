<script setup lang="ts">
import { format } from 'date-fns'

const props = defineProps<{
  contact: Contact
}>()

const { compose } = useComposer()
const { openEdit, confirmRemove, selectedId } = useContactsPage()

const subtitle = computed(() => [props.contact.title, props.contact.company].filter(Boolean).join(' at '))
const birthday = computed(() => {
  if (!props.contact.birthday) return undefined
  const date = new Date(props.contact.birthday)
  return Number.isNaN(date.getTime()) ? props.contact.birthday : format(date, 'd MMMM yyyy')
})
</script>

<template>
  <article class="flex flex-col min-h-0 bg-default">
    <header class="shrink-0 flex items-center gap-1 h-14 px-3 border-b border-default">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        aria-label="Back"
        class="lg:hidden"
        @click="selectedId = undefined"
      />
      <div class="ms-auto flex items-center gap-1">
        <UButton
          icon="i-lucide-pencil"
          label="Edit"
          color="neutral"
          variant="ghost"
          @click="openEdit(contact)"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          aria-label="Delete contact"
          @click="confirmRemove(contact)"
        />
      </div>
    </header>

    <div class="flex-1 overflow-y-auto">
      <div class="max-w-xl mx-auto px-6 py-10 flex flex-col items-center gap-6">
        <div class="flex flex-col items-center gap-3 text-center">
          <SenderAvatar
            :address="{ name: contact.name, address: contact.emails[0] ?? contact.name }"
            size="3xl"
          />
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-highlighted">
              {{ contact.name }}
            </h1>
            <p
              v-if="subtitle"
              class="text-muted"
            >
              {{ subtitle }}
            </p>
          </div>
          <UButton
            v-if="contact.emails[0]"
            icon="i-lucide-mail"
            label="Write"
            @click="compose([{ name: contact.name, address: contact.emails[0] }])"
          />
        </div>

        <UCard
          class="w-full"
          :ui="{ body: 'p-0 sm:p-0 divide-y divide-default' }"
        >
          <ContactsField
            v-for="email in contact.emails"
            :key="email"
            label="Email"
            :value="email"
            icon="i-lucide-mail"
            action
            @open="compose([{ name: contact.name, address: email }])"
          />
          <ContactsField
            v-for="phone in contact.phones"
            :key="phone"
            label="Phone"
            :value="phone"
            icon="i-lucide-phone"
            :to="`tel:${phone.replace(/\s/g, '')}`"
          />
          <ContactsField
            v-if="birthday"
            label="Birthday"
            :value="birthday"
            icon="i-lucide-cake"
          />
          <ContactsField
            v-if="contact.note"
            label="Note"
            :value="contact.note"
            icon="i-lucide-sticky-note"
          />
        </UCard>
      </div>
    </div>
  </article>
</template>
