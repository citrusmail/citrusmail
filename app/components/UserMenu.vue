<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{
  /** The sidebar is folded: only the picture shows */
  collapsed?: boolean
}>()

const colorMode = useColorMode()
const { account } = useShell()
const { settings } = useSettings()
const { others, switchTo, signOutOf, signOutAll, add } = useMailboxes()

const appearance = (value: 'light' | 'dark' | 'system', label: string, icon: string): DropdownMenuItem => ({
  label,
  icon,
  type: 'checkbox',
  checked: colorMode.preference === value,
  onSelect: (event: Event) => {
    event.preventDefault()
    colorMode.preference = value
  }
})

const label = computed(() => account.value?.name || account.value?.email)

const items = computed<DropdownMenuItem[][]>(() => [[{
  type: 'label',
  label: label.value,
  description: account.value?.name ? account.value.email : undefined,
  avatar: { alt: label.value, src: settings.value.avatar }
}, ...others.value.map((mailbox, index): DropdownMenuItem => ({
  label: mailbox.name || mailbox.email,
  description: mailbox.name ? mailbox.email : undefined,
  avatar: { alt: mailbox.name || mailbox.email, size: '2xs' },
  kbds: index < 3 ? ['ctrl', String(index + 2)] : undefined,
  onSelect: () => switchTo(mailbox.email)
})), {
  label: 'Add a mailbox',
  icon: 'i-lucide-plus',
  onSelect: add
}], [{
  label: 'Settings',
  icon: 'i-lucide-settings',
  to: '/settings/profile'
}, {
  label: 'Appearance',
  icon: 'i-lucide-sun-moon',
  children: [
    appearance('system', 'System', 'i-lucide-monitor'),
    appearance('light', 'Light', 'i-lucide-sun'),
    appearance('dark', 'Dark', 'i-lucide-moon')
  ]
}, {
  label: 'Keyboard shortcuts',
  icon: 'i-lucide-keyboard',
  kbds: ['?'],
  onSelect: () => useShortcutsHelp().open()
}], [
  ...(others.value.length ? [{ label: `Sign out of ${account.value?.email}`, icon: 'i-lucide-log-out', onSelect: () => signOutOf(account.value!.email) }] : []),
  { label: others.value.length ? 'Sign out of all mailboxes' : 'Sign out', icon: 'i-lucide-log-out', onSelect: signOutAll }
]])

// Ctrl+2, 3, 4 open the other mailboxes
defineShortcuts(Object.fromEntries([0, 1, 2].map(index => [`ctrl_${index + 2}`, () => others.value[index] && switchTo(others.value[index]!.email)])))
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: collapsed ? 'start' : 'center', side: collapsed ? 'right' : 'top', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'min-w-64' : 'w-(--reka-dropdown-menu-trigger-width) min-w-64' }"
  >
    <UButton
      :avatar="{ alt: label, src: settings.avatar, size: 'xs', chip: others.length ? { color: 'neutral', text: String(others.length + 1), size: 'md' } : undefined }"
      :label="collapsed ? undefined : label"
      :aria-label="collapsed ? `${label}, mailboxes and settings` : undefined"
      color="neutral"
      variant="ghost"
      :block="!collapsed"
      :square="collapsed"
      :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
      class="data-[state=open]:bg-(--control-bg)"
      :class="collapsed && 'mx-auto'"
      :ui="{ trailingIcon: 'text-dimmed', label: 'truncate' }"
    />
  </UDropdownMenu>
</template>
