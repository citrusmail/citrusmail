<script setup lang="ts">
const props = defineProps<{
  size?: 'md' | 'lg'
  /** Only the mark, for the folded sidebar */
  markOnly?: boolean
}>()

const large = computed(() => props.size === 'lg')
const brand = useBrand()
const colorMode = useColorMode()
const logoSrc = computed(() => colorMode.value === 'dark' && brand.value.logoDark ? brand.value.logoDark : brand.value.logo)
</script>

<!-- The citrus mark (LogoMark), then the wordmark set in the UI face, heavier,
  tracked tight, with the byline under it -->
<template>
  <span class="inline-flex items-center gap-2.5 text-highlighted">
    <img
      v-if="logoSrc"
      :src="logoSrc"
      :alt="brand.name"
      :class="large ? 'h-11' : 'h-8'"
      class="w-auto"
    >
    <LogoMark
      v-else
      :class="large ? 'size-11' : 'size-8'"
    />
    <span
      v-if="!markOnly"
      class="flex flex-col"
    >
      <span
        class="font-bold tracking-[-0.03em] leading-none"
        :class="large ? 'text-[28px]' : 'text-[19px]'"
      >{{ brand.name }}</span>
      <span
        v-if="brand.byline"
        class="font-medium text-muted leading-none"
        :class="large ? 'text-[13px] mt-1.5' : 'text-[11px] mt-1'"
      >{{ brand.byline }}</span>
    </span>
  </span>
</template>
