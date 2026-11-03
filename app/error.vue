<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const notFound = computed(() => props.error.statusCode === 404)

useSeoMeta({
  title: () => notFound.value ? 'Page not found' : 'Something went wrong',
  description: () => notFound.value
    ? 'We are sorry but this page could not be found.'
    : 'We are sorry but an unexpected error occurred.'
})

useHead({
  htmlAttrs: {
    lang: 'en'
  }
})
</script>

<template>
  <UApp>
    <UError
      :error="error"
      :clear="{ label: 'Back to inbox', to: '/mail/INBOX' }"
      class="min-h-svh"
    />
  </UApp>
</template>
