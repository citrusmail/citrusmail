<script setup lang="ts">
// Which mailboxes ring, and for the open one, which folders
const { prefs, set } = useNotificationSettings()
const { mailboxes } = useMailboxes()
const { account } = useShell()
const { folders } = useMail()

const current = computed(() => account.value?.email.toLowerCase() ?? '')
const folderItems = computed(() => folders.value.map(folder => ({ label: folder.name, value: folder.path })))
const chosen = computed(() => prefs.value.folders[current.value]?.length ? prefs.value.folders[current.value]! : ['INBOX'])

function mute(email: string, on: boolean) {
  const key = email.toLowerCase()
  set({ muted: on ? prefs.value.muted.filter(item => item !== key) : [...prefs.value.muted, key] })
}

function setFolders(paths: string[]) {
  set({ folders: { ...prefs.value.folders, [current.value]: paths.length ? paths : ['INBOX'] } })
}
</script>

<template>
  <fieldset class="flex flex-col gap-4">
    <legend class="text-sm font-semibold text-highlighted mb-3">
      Mailboxes
    </legend>
    <USwitch
      v-for="mailbox in mailboxes"
      :key="mailbox.email"
      :model-value="!prefs.muted.includes(mailbox.email.toLowerCase())"
      :label="mailbox.name || mailbox.email"
      :description="mailbox.name ? mailbox.email : undefined"
      @update:model-value="mute(mailbox.email, $event)"
    />

    <UFormField
      v-if="account?.protocol !== 'pop3' && folderItems.length"
      :label="`Folders to watch in ${account?.email}`"
      description="Inbox unless you choose others. Switch mailbox to choose its folders."
      class="mt-2"
    >
      <USelectMenu
        :model-value="chosen"
        :items="folderItems"
        value-key="value"
        multiple
        class="w-full max-w-sm mt-1"
        @update:model-value="setFolders($event as string[])"
      />
    </UFormField>
  </fieldset>
</template>
