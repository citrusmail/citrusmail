<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { account } = useShell()
const { books, contacts, openCreate } = useContactsPage()
const route = useRoute()

const items = computed<NavigationMenuItem[]>(() => [
  { label: 'All contacts', icon: 'i-lucide-users', to: { path: '/contacts' }, active: !route.query.book, badge: contacts.value.length || undefined },
  ...(books.value.length > 1
    ? books.value.map(book => ({
        label: book.name,
        icon: 'i-lucide-book-user',
        to: { path: '/contacts', query: { book: book.id } },
        active: route.query.book === book.id,
        badge: contacts.value.filter(contact => contact.bookId === book.id).length || undefined
      }))
    : [])
])
</script>

<template>
  <template v-if="account?.hasContacts">
    <UButton
      icon="i-lucide-user-plus"
      label="New contact"
      block
      @click="openCreate"
    />
    <UNavigationMenu
      :items="items"
      orientation="vertical"
    />
  </template>
</template>
