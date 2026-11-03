<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const props = defineProps<{
  /** The sidebar is folded to icons */
  collapsed?: boolean
}>()

const { folders, folderPath } = useMail()
const { account } = useShell()
const { promptCreate } = useFolderDialogs()
const route = useRoute()
const { scheduled } = useScheduled()

function badgeOf(folder: Folder) {
  // Drafts counts what's waiting to go out; elsewhere, what's unread
  if (folder.role === 'drafts' && scheduled.value.length) return { label: String(scheduled.value.length), icon: 'i-lucide-clock', color: 'neutral' as const, variant: 'subtle' as const }
  return folder.role && unreadOf(folder) ? { label: String(folder.unread), color: 'neutral' as const, variant: 'subtle' as const } : undefined
}

const INDENT = ['', 'ps-5', 'ps-8', 'ps-11']

// Unread only matters where new mail lands; a count on Trash is noise
const unreadOf = (folder: Folder) => folder.unread && folder.role !== 'trash' && folder.role !== 'sent' ? folder.unread : 0
const onFolders = computed(() => route.path.startsWith('/mail/'))

const items = computed<NavigationMenuItem[]>(() => folders.value.map(folder => ({
  label: folder.name,
  icon: folderIcon(folder),
  to: folderLink(folder.path),
  active: onFolders.value && folder.path === folderPath.value,
  badge: badgeOf(folder),
  // Folders you made get a menu to rename, nest or delete them
  slot: folder.role ? undefined : 'custom' as const,
  folder,
  // Folded, every icon sits in the same column, nested or not
  class: ['group', props.collapsed ? '' : INDENT[Math.min(folder.depth, 3)]]
})))

// The menu's slot loses the item's extra fields in its types
const folderOf = (item: unknown) => (item as { folder: Folder }).folder

const canFolder = computed(() => account.value?.protocol !== 'pop3')
</script>

<template>
  <MailComposeButton :collapsed="collapsed" />

  <template v-if="folders.length">
    <UNavigationMenu
      :items="items"
      orientation="vertical"
      :collapsed="collapsed"
      :tooltip="{ content: { side: 'right' } }"
      :ui="{ linkTrailingBadge: 'font-semibold tabular-nums' }"
    >
      <template #custom-trailing="{ item }">
        <UBadge
          v-if="unreadOf(folderOf(item))"
          :label="String(folderOf(item).unread)"
          color="neutral"
          variant="subtle"
          size="sm"
          class="font-semibold tabular-nums group-hover:hidden"
        />
        <MailFolderMenu :folder="folderOf(item)" />
      </template>
    </UNavigationMenu>

    <UButton
      v-if="canFolder && !collapsed"
      label="New folder"
      icon="i-lucide-plus"
      color="neutral"
      variant="ghost"
      size="sm"
      class="justify-start text-muted -mt-2 px-2.5"
      @click="promptCreate()"
    />

    <MailSidebarExtras :collapsed="collapsed" />
  </template>

  <div
    v-else
    class="flex flex-col gap-2 px-1 py-1"
  >
    <USkeleton
      v-for="n in 6"
      :key="n"
      class="h-7 rounded-md"
    />
  </div>
</template>
