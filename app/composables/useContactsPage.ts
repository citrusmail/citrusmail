// The contacts page: search, the selected contact and the editor slideover
const _useContactsPage = () => {
  const route = useRoute()
  const router = useRouter()
  const { contacts, books, status, save, remove } = useContacts()
  const overlay = useOverlay()

  const search = ref('')
  const book = computed(() => route.query.book as string | undefined)

  const filtered = computed(() => {
    const term = search.value.trim().toLowerCase()
    return contacts.value.filter(contact =>
      (!book.value || contact.bookId === book.value)
      && (!term || [contact.name, contact.company, ...contact.emails, ...contact.phones].some(value => value?.toLowerCase().includes(term))))
  })

  // Grouped under their first letter, the way an address book reads
  const groups = computed(() => {
    const map = new Map<string, Contact[]>()
    for (const contact of filtered.value) {
      const letter = /^[a-z]/i.test(contact.name) ? contact.name[0]!.toUpperCase() : '#'
      map.set(letter, [...(map.get(letter) ?? []), contact])
    }
    return [...map.entries()].map(([letter, items]) => ({ letter, items }))
  })

  const selectedId = computed<string | undefined>({
    get: () => route.query.c as string | undefined,
    set: id => router.replace({ query: { ...route.query, c: id || undefined } })
  })
  const selected = computed(() => contacts.value.find(contact => contact.id === selectedId.value))

  const editorOpen = ref(false)
  const editing = ref<Contact | null>(null)

  function openCreate() {
    editing.value = { id: '', bookId: book.value ?? books.value[0]?.id ?? '', name: '', emails: [''], phones: [] }
    editorOpen.value = true
  }

  function openEdit(contact: Contact) {
    editing.value = { ...contact, emails: contact.emails.length ? [...contact.emails] : [''], phones: [...contact.phones] }
    editorOpen.value = true
  }

  async function submit(contact: Contact) {
    const saved = await save({ ...contact, emails: contact.emails.filter(Boolean), phones: contact.phones.filter(Boolean) })
    if (saved) {
      editorOpen.value = false
      selectedId.value = saved.id
    }
  }

  async function confirmRemove(contact: Contact) {
    const ConfirmDialog = (await import('~/components/confirm-dialog/index.vue')).default
    const modal = overlay.create(ConfirmDialog, {
      props: { title: `Delete ${contact.name}?`, message: 'The contact is removed from your address book on every device.', confirmLabel: 'Delete contact' }
    })
    if (await modal.open().result) {
      selectedId.value = undefined
      await remove(contact)
    }
  }

  return { contacts, books, status, search, groups, filtered, selectedId, selected, editorOpen, editing, openCreate, openEdit, submit, confirmRemove }
}

export const useContactsPage = createAppComposable(_useContactsPage)
