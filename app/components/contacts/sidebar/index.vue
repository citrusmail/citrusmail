<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

// New contact, everyone, then your address books when there's more than
// one, each with how many people it holds: the same rows and counts as
// CitrusMail for Faivelo's Contacts sidebar with one mailbox
const { account } = useShell()
const { books, contacts, openCreate } = useContactsPage()
const route = useRoute()

const items = computed<NavigationMenuItem[]>(() => [
  { label: 'All contacts', icon: 'i-lucide-users', to: { path: '/contacts' }, active: !route.query.book, badge: countBadge(contacts.value.length) },
  ...(books.value.length > 1
    ? books.value.map(book => ({
        label: book.name,
        icon: 'i-lucide-book-user',
        to: { path: '/contacts', query: { book: book.id } },
        active: route.query.book === book.id,
        badge: countBadge(contacts.value.filter(contact => contact.bookId === book.id).length)
      }))
    : [])
])
</script>

<template>
  <template v-if="account?.hasContacts">
    <UButton
      icon="i-lucide-user-plus"
      color="neutral"
      variant="soft"
      label="New contact"
      @click="openCreate()"
    />
    <UNavigationMenu
      :items="items"
      orientation="vertical"
    />
  </template>
</template>
