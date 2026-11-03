<script setup lang="ts">
const { isSidebarOpen, isMobile, toggleSidebar, section } = useShell()
const route = useRoute()

// Close the slideover once something in it has been chosen
watch(() => route.fullPath, () => {
  if (isMobile.value) isSidebarOpen.value = false
})

defineShortcuts({ '[': () => !isMobile.value && toggleSidebar() })
</script>

<template>
  <USidebar
    v-model:open="isSidebarOpen"
    collapsible="icon"
    rail
    :transition="true"
    :menu="{ inset: true, transition: false }"
    :ui="{
      root: '[--sidebar-width:17rem] [--sidebar-width-icon:4.25rem]',
      container: 'border-0 bg-(--lb-desk-solid) lg:bg-transparent',
      inner: 'bg-transparent divide-y-0',
      header: 'flex-col items-stretch gap-3 px-3 pt-3 pb-1 in-[.desktop]:pt-11 in-[.desktop]:[-webkit-app-region:drag]',
      body: 'pt-2 px-3 gap-3 in-data-[state=collapsed]:px-2 in-data-[state=collapsed]:items-center',
      footer: 'px-3 pb-3 pt-2'
    }"
  >
    <template #header="{ close, state }">
      <div
        class="flex items-center gap-1 min-h-9"
        :class="state === 'collapsed' && 'justify-center'"
      >
        <NuxtLink
          to="/mail/INBOX"
          aria-label="Inbox"
          class="flex items-center gap-2 rounded-md px-1 [-webkit-app-region:no-drag] outline-primary focus-visible:outline-2 outline-offset-2"
        >
          <AppLogo :mark-only="state === 'collapsed'" />
        </NuxtLink>

        <div
          v-if="state === 'expanded'"
          class="ms-auto flex items-center gap-1 [-webkit-app-region:no-drag]"
        >
          <NewEventMenu v-if="section === 'calendar'" />
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Close menu"
            class="lg:hidden"
            @click="close"
          />
        </div>
      </div>

      <SectionTabs :collapsed="state === 'collapsed'" />
    </template>

    <template #default="{ state }">
      <MailSidebar
        v-if="section === 'mail'"
        :collapsed="state === 'collapsed'"
      />
      <template v-else-if="state === 'expanded'">
        <CalendarSidebar v-if="section === 'calendar'" />
        <ContactsSidebar v-else-if="section === 'contacts'" />
        <SettingsSidebar v-else />
      </template>
      <SettingsSidebar
        v-else-if="section === 'settings'"
        collapsed
      />
    </template>

    <template #footer="{ state }">
      <div
        class="flex items-center gap-1 w-full"
        :class="state === 'collapsed' && 'flex-col-reverse'"
      >
        <div class="flex-1 min-w-0 flex justify-center">
          <UserMenu :collapsed="state === 'collapsed'" />
        </div>
        <SidebarFoldButton :collapsed="state === 'collapsed'" />
      </div>
    </template>
  </USidebar>
</template>
