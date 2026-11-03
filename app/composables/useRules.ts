import { SettingsRuleEditor } from '#components'

export const RULE_FIELDS: { label: string, value: RuleField }[] = [
  { label: 'From', value: 'from' },
  { label: 'To', value: 'to' },
  { label: 'Subject', value: 'subject' }
]

/** "From contains acme.com and Subject contains invoice" */
export function describeConditions(rule: Pick<MailRule, 'conditions' | 'match'>) {
  return rule.conditions
    .map(condition => `${RULE_FIELDS.find(field => field.value === condition.field)?.label} contains “${condition.value}”`)
    .join(rule.match === 'any' ? ' or ' : ' and ')
}

// Rules live on the CitrusMail server, which runs them each time mail is checked
export function useRules() {
  const toast = useToast()
  const overlay = useOverlay()
  const { refreshFolders } = useMail()

  const { data: rules, status } = useFetch<MailRule[]>('/api/rules', { key: 'rules', server: false, default: () => [] })
  const saving = ref(false)

  async function saveAll(next: RuleInput[], done: string) {
    saving.value = true
    try {
      const result = await $fetch<{ rules: MailRule[], moved: number }>('/api/rules', { method: 'PUT', body: { rules: next } })
      rules.value = result.rules
      toast.add({
        title: done,
        description: result.moved ? `${result.moved} ${result.moved === 1 ? 'message' : 'messages'} filed from your Inbox.` : undefined,
        icon: 'i-lucide-check'
      })
      await refreshFolders()
      return true
    } catch (error) {
      const message = (error as { data?: { message?: string } }).data?.message
      toast.add({ title: 'Couldn’t save the rule', description: message, color: 'error', icon: 'i-lucide-circle-alert' })
      return false
    } finally {
      saving.value = false
    }
  }

  async function edit(rule?: MailRule, folder?: string) {
    const modal = overlay.create(SettingsRuleEditor, { props: { rule, folder } })
    const result = await modal.open().result
    if (!result) return
    const exists = rules.value.some(item => item.id === result.id)
    await saveAll(exists ? rules.value.map(item => item.id === result.id ? result : item) : [...rules.value, result], exists ? 'Rule saved' : 'Rule added')
  }

  async function toggle(rule: MailRule, enabled: boolean) {
    await saveAll(rules.value.map(item => item.id === rule.id ? { ...item, enabled } : item), enabled ? 'Rule turned on' : 'Rule turned off')
  }

  async function remove(rule: MailRule) {
    await saveAll(rules.value.filter(item => item.id !== rule.id), 'Rule deleted')
  }

  return { rules, status, saving, edit, toggle, remove }
}
