<script setup lang="ts">
// Scheduled messages live with your drafts now; old links land there
const { folders } = useMail()
const stop = watchEffect(() => {
  if (!folders.value.length) return
  const drafts = folders.value.find(folder => folder.role === 'drafts')
  navigateTo(folderLink(drafts?.path ?? 'INBOX'), { replace: true })
  nextTick(() => stop())
})
</script>

<template>
  <div />
</template>
