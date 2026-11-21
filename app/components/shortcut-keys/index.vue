<script setup lang="ts">
// The keys of one shortcut, as keycaps
defineProps<{ keys: string[] }>()
</script>

<template>
  <span class="shrink-0 flex items-center gap-0.5">
    <UKbd
      v-for="key in keys"
      :key="key"
      :value="key"
      variant="soft"
    />
  </span>
</template>
