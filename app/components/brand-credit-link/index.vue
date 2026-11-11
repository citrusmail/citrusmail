<script setup lang="ts">
// The maker's name, linked to their site when the brand gives one
const brand = useBrand()
</script>

<template>
  <ULink
    v-if="brand.creditUrl"
    :to="brand.creditUrl"
    target="_blank"
    rel="noopener"
    class="font-medium text-muted hover:text-highlighted"
  >
    {{ brand.credit }}
  </ULink>
  <span v-else>{{ brand.credit }}</span>
</template>
