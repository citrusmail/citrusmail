<script setup lang="ts">
// The logo, home to the Inbox. Folded, it's also how the sidebar opens
// again: pointing at it turns it into the panel button
defineProps<{ collapsed: boolean }>()
const { toggleSidebar } = useShell()
</script>

<template>
  <UTooltip
    v-if="collapsed"
    text="Show sidebar"
    :kbds="['[']"
    :content="{ side: 'right' }"
  >
    <button
      type="button"
      aria-label="Show sidebar"
      class="group relative grid place-items-center size-9 rounded-lg [-webkit-app-region:no-drag] hover:bg-(--lb-tab-active)/55 focus-visible:outline-2 focus-visible:outline-primary"
      @click="toggleSidebar"
    >
      <AppLogo
        mark-only
        class="transition-opacity duration-150 group-hover:opacity-0 group-focus-visible:opacity-0 [&_svg]:size-7 [&_img]:h-7"
      />
      <UIcon
        name="i-lucide-panel-left-open"
        class="absolute size-[18px] text-highlighted opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      />
    </button>
  </UTooltip>
  <NuxtLink
    v-else
    to="/mail/INBOX"
    aria-label="Inbox"
    class="flex items-center gap-2 rounded-md px-1 [-webkit-app-region:no-drag] outline-primary focus-visible:outline-2 outline-offset-2"
  >
    <AppLogo />
  </NuxtLink>
</template>
