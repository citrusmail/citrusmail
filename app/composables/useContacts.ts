// Contacts from the CardDAV server, fetched once and shared by the contacts
// page and the composer's recipient suggestions
const _useContacts = () => {
  const toast = useToast()
  const { account } = useShell()

  const { data: contacts, status, refresh } = useFetch<Contact[]>('/api/contacts', {
    key: 'contacts',
    default: () => [],
    server: false,
    immediate: !!account.value?.hasContacts
  })

  const { data: books } = useFetch<ContactBook[]>('/api/books', {
    key: 'books',
    default: () => [],
    server: false,
    immediate: !!account.value?.hasContacts
  })

  async function save(contact: Contact) {
    try {
      const saved = contact.id
        ? await $fetch<Contact>(`/api/contacts/${contact.id}`, { method: 'PUT', body: contact })
        : await $fetch<Contact>('/api/contacts', { method: 'POST', body: contact })
      contacts.value = [...contacts.value.filter(item => item.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name))
      toast.add({ title: contact.id ? 'Contact saved' : 'Contact added', icon: 'i-lucide-check' })
      return saved
    } catch (error) {
      const message = (error as { data?: { message?: string } }).data?.message
      toast.add({ title: 'Couldn’t save the contact', description: message, color: 'error', icon: 'i-lucide-circle-alert' })
    }
  }

  async function remove(contact: Contact) {
    const before = contacts.value
    contacts.value = contacts.value.filter(item => item.id !== contact.id)
    try {
      await $fetch(`/api/contacts/${contact.id}`, { method: 'DELETE' })
      toast.add({ title: 'Contact deleted', icon: 'i-lucide-trash-2' })
    } catch {
      contacts.value = before
      toast.add({ title: 'Couldn’t delete the contact', color: 'error', icon: 'i-lucide-circle-alert' })
    }
  }

  return { contacts, books, status, refresh, save, remove }
}

export const useContacts = createAppComposable(_useContacts)
