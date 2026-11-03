<script setup lang="ts">
const { folder, filter, total, status, load, refreshTop, ai } = useMail()
const { isSidebarOpen } = useShell()

// When the list is narrow the filters shrink to icons, so nothing overlaps
const tabs = [
  { label: 'All', value: 'all', icon: 'i-lucide-mails' },
  { label: 'Unread', value: 'unread', icon: 'i-lucide-mail-open' },
  { label: 'Flagged', value: 'flagged', icon: 'i-lucide-flag' }
]

const refreshing = ref(false)
async function refresh() {
  refreshing.value = true
  await Promise.all([refreshTop(), new Promise(resolve => setTimeout(resolve, 400))])
  refreshing.value = false
}
</script>

<template>
  <section class="@container relative flex flex-col min-h-0 h-full">
    <header class="shrink-0 flex items-center gap-1 @sm:gap-2 h-14 ps-4 pe-3 border-b border-default">
      <UButton
        icon="i-lucide-menu"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Open menu"
        class="lg:hidden shrink-0 -ms-1.5"
        @click="isSidebarOpen = true"
      />

      <h1 class="flex-1 min-w-0 flex items-baseline gap-2">
        <span class="text-lg font-bold tracking-tight text-highlighted truncate">{{ folder?.name ?? 'Inbox' }}</span>
        <span
          v-if="status !== 'loading' && total"
          class="shrink-0 text-sm text-muted tabular-nums @max-[24rem]:hidden"
        >{{ total.toLocaleString() }}</span>
      </h1>

      <UTooltip text="Check for new mail">
        <UButton
          icon="i-lucide-rotate-cw"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Check for new mail"
          :ui="{ leadingIcon: refreshing || status === 'refreshing' ? 'animate-spin' : '' }"
          @click="refresh"
        />
      </UTooltip>

      <MailViewToggle />

      <UTabs
        v-model="filter"
        :items="tabs"
        :content="false"
        color="neutral"
        size="xs"
        class="shrink-0 w-auto"
        :ui="{ trigger: 'px-2 @max-[30rem]:px-1.5', label: '@max-[30rem]:sr-only', leadingIcon: 'size-3.5 @min-[30rem]:hidden' }"
      />
    </header>

    <MailSearchBar />

    <MailScheduledSection v-if="folder?.role === 'drafts' && !ai.on" />

    <MailAiResults v-if="ai.on" />

    <MailList v-else-if="status !== 'error'" />

    <UEmpty
      v-else
      icon="i-lucide-wifi-off"
      title="Couldn’t load this folder"
      description="The mail server didn’t answer. It may be busy, or your connection dropped."
      :actions="[{ label: 'Try again', icon: 'i-lucide-rotate-cw', color: 'neutral', variant: 'outline', onClick: () => load() }]"
      variant="naked"
      class="flex-1"
    />
  </section>
</template>
