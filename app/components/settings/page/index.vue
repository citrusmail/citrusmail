<script setup lang="ts">
defineProps<{
  title: string
  description: string
}>()

const { isSidebarOpen } = useShell()
</script>

<template>
  <section class="flex-1 min-w-0 flex flex-col">
    <header class="shrink-0 flex items-center gap-2 h-14 px-4 border-b border-default">
      <UButton
        icon="i-lucide-menu"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Open menu"
        class="lg:hidden shrink-0 -ms-1.5"
        @click="isSidebarOpen = true"
      />
      <h1 class="text-lg font-bold tracking-tight text-highlighted">
        {{ title }}
      </h1>
    </header>

    <div class="flex-1 overflow-y-auto">
      <div class="max-w-2xl px-5 sm:px-8 py-8">
        <p class="text-sm text-muted mb-8">
          {{ description }}
        </p>
        <slot />
      </div>
    </div>
  </section>
</template>
