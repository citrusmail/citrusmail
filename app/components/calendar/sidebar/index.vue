<script setup lang="ts">
const { isSearchOpen } = useCalendar()
const { account } = useShell()
</script>

<template>
  <template v-if="account?.hasCalendar">
    <UButton
      icon="i-lucide-search"
      color="neutral"
      variant="soft"
      label="Search events"
      @click="isSearchOpen = true"
    >
      <template #trailing>
        <span class="hidden lg:flex items-center gap-0.5 ms-auto">
          <UKbd
            value="meta"
            variant="soft"
          />
          <UKbd
            value="k"
            variant="soft"
          />
        </span>
      </template>
    </UButton>

    <CalendarList />

    <USeparator class="mt-auto" />

    <CalendarMini />
  </template>
</template>
