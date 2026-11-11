<script setup lang="ts">
// Who makes the app and that it's open source, with a link to the code. Each
// part comes from the brand (app.config.ts or NUXT_PUBLIC_BRAND_*) and hides
// when it's empty
const props = defineProps<{
  /** One short line, for narrow places like the sidebar */
  short?: boolean
}>()

const brand = useBrand()
const open = computed(() => !!brand.value.source)

/** The sentence up to the maker's name ("… by"), or '' to show nothing */
const lead = computed(() => {
  const { name, credit, builtOn } = brand.value
  if (!open.value && !credit) return ''
  if (props.short) return open.value ? 'Open source' : 'Made'
  if (builtOn) return `Built on ${builtOn}, ${open.value ? 'a free, open-source project' : 'made'}`
  if (!open.value) return `${name} is made`
  return credit ? `${name} is free and open source, made` : `${name} is free and open source`
})
</script>

<template>
  <p
    v-if="lead"
    class="text-xs text-muted text-pretty"
  >
    {{ lead }}<template v-if="brand.credit">
      {{ ' by ' }}<BrandCreditLink />
    </template>{{ short ? '' : '.' }}
    <template v-if="open">
      <span
        class="mx-1"
        aria-hidden="true"
      >·</span>
      <ULink
        :to="brand.source"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center gap-1 align-bottom font-medium text-muted hover:text-highlighted"
      >
        <UIcon
          name="i-simple-icons-github"
          class="size-3.5"
        />
        GitHub
      </ULink>
    </template>
  </p>
</template>
