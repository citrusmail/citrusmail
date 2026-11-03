<script setup lang="ts">
const colorMode = useColorMode()

const color = computed(() => colorMode.value === 'dark' ? '#1b1718' : 'white')

const brand = useBrand()

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    { key: 'theme-color', name: 'theme-color', content: color }
  ],
  link: computed(() => brand.value.favicon
    ? [{ rel: 'icon', href: brand.value.favicon }]
    // The painted icon; the SVG is a flat fallback and stays out of the way
    : [
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', type: 'image/png', href: '/icon-512.png', sizes: '512x512' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
      ]),
  htmlAttrs: {
    lang: 'en'
  }
})

useSeoMeta({
  title: () => brand.value.name,
  titleTemplate: title => title && title !== brand.value.name ? `${title} · ${brand.value.name}` : brand.value.name,
  description: 'Open-source mail, calendar and contacts for any IMAP, SMTP, POP3, CalDAV and CardDAV account.'
})
</script>

<template>
  <UApp :toaster="{ position: 'bottom-center', duration: 4000 }">
    <NuxtLoadingIndicator color="var(--ui-primary)" />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
