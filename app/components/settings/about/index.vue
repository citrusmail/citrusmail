<script setup lang="ts">
// Settings → About: the app, its version, who makes it and where its code is.
// Every line comes from the brand and hides when it's empty
const brand = useBrand()
const version = useRuntimeConfig().public.version as string | undefined

/** Issues and the license file have known places on GitHub */
const github = computed(() => /^https:\/\/github\.com\/[^/]+\/[^/]+/.exec(brand.value.source)?.[0])

const links = computed(() => {
  const { source, credit, creditUrl, license } = brand.value
  return [
    source && { label: 'Source code', icon: 'i-simple-icons-github', to: source },
    github.value && { label: 'Report a problem', icon: 'i-lucide-bug', to: `${github.value}/issues` },
    license && github.value && { label: `${license} License`, icon: 'i-lucide-scale', to: `${github.value}/blob/main/LICENSE` },
    credit && creditUrl && { label: credit, icon: 'i-lucide-globe', to: creditUrl }
  ].filter(Boolean) as { label: string, icon: string, to: string }[]
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-3">
      <AppLogo size="lg" />
      <p
        v-if="version"
        class="text-sm text-muted"
      >
        Version {{ version }}
      </p>
    </div>

    <OpenSourceNote class="text-sm" />
    <p
      v-if="brand.license && !github"
      class="text-sm text-muted"
    >
      Released under the {{ brand.license }} License.
    </p>

    <div
      v-if="links.length"
      class="flex flex-wrap gap-2"
    >
      <UButton
        v-for="link in links"
        :key="link.to"
        :label="link.label"
        :icon="link.icon"
        :to="link.to"
        target="_blank"
        rel="noopener"
        color="neutral"
        variant="outline"
      />
    </div>
  </div>
</template>
