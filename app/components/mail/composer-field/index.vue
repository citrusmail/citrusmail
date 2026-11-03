<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>

<!-- The label lights up while its field has the cursor, so you always know which line you're on -->
<template>
  <div class="group/field relative flex items-center gap-3 min-h-11 px-5 border-b border-default transition-colors duration-150 focus-within:bg-(--lb-field-active)">
    <span
      aria-hidden="true"
      class="absolute inset-y-2 start-0 w-0.5 rounded-full bg-primary scale-y-0 transition-transform duration-200 ease-out group-focus-within/field:scale-y-100 motion-reduce:transition-none"
    />
    <span class="w-14 shrink-0 text-sm text-muted transition-colors duration-150 group-focus-within/field:text-primary group-focus-within/field:font-medium">{{ label }}</span>
    <div class="flex-1 min-w-0 flex items-center gap-2">
      <slot />
    </div>
  </div>
</template>
