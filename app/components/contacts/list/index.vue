<script setup lang="ts">
const { search, groups, filtered, status, selectedId } = useContactsPage()
const { isSidebarOpen } = useShell()
</script>

<template>
  <section class="flex flex-col min-h-0 h-full">
    <header class="shrink-0 flex flex-col gap-3 px-4 pt-3 pb-3 border-b border-default">
      <div class="flex items-center gap-2 min-h-8">
        <UButton
          icon="i-lucide-menu"
          color="neutral"
          variant="soft"
          size="sm"
          aria-label="Open menu"
          class="lg:hidden shrink-0"
          @click="isSidebarOpen = true"
        />
        <h1 class="flex-1 flex items-baseline gap-2">
          <span class="text-xl font-bold tracking-tight text-highlighted">Contacts</span>
          <span class="text-sm text-muted tabular-nums">{{ filtered.length }}</span>
        </h1>
      </div>
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search contacts"
        variant="soft"
        :ui="{ base: 'bg-(--control-bg) rounded-full' }"
      />
    </header>

    <div
      v-if="status === 'pending' && !filtered.length"
      class="p-4 flex flex-col gap-3"
    >
      <USkeleton
        v-for="n in 8"
        :key="n"
        class="h-9"
      />
    </div>

    <UEmpty
      v-else-if="!filtered.length"
      :icon="search ? 'i-lucide-search-x' : 'i-lucide-users'"
      :title="search ? 'No matches' : 'No contacts yet'"
      :description="search ? `Nobody matches “${search}”.` : 'Contacts you add here sync to your other devices.'"
      variant="naked"
      class="flex-1"
    />

    <div
      v-else
      class="flex-1 overflow-y-auto px-2 pb-4"
    >
      <section
        v-for="group in groups"
        :key="group.letter"
      >
        <h2 class="sticky top-0 z-1 px-3 pt-3 pb-1 text-xs font-semibold text-muted bg-default/90 glass-material">
          {{ group.letter }}
        </h2>
        <UButton
          v-for="contact in group.items"
          :key="contact.id"
          color="neutral"
          variant="ghost"
          :aria-current="contact.id === selectedId || undefined"
          block
          class="justify-start gap-3 px-3 py-2 rounded-md font-normal"
          :class="contact.id === selectedId ? 'bg-(--lb-selected) hover:bg-(--lb-selected) text-highlighted' : 'hover:bg-elevated/60'"
          @click="selectedId = contact.id"
        >
          <SenderAvatar
            :address="{ name: contact.name, address: contact.emails[0] ?? contact.name }"
            size="sm"
          />
          <span class="flex-1 min-w-0 text-start">
            <span class="block truncate font-medium">{{ contact.name }}</span>
            <span
              v-if="contact.company || contact.emails[0]"
              class="block truncate text-xs text-muted"
            >{{ contact.company || contact.emails[0] }}</span>
          </span>
        </UButton>
      </section>
    </div>
  </section>
</template>
