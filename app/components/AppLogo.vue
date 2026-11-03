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
// Unique per instance, since the logo can be on screen twice
const clip = `logo-overlap-${useId()}`
</script>

<!-- The mark is two citrus slices on a rising diagonal, a pale and a bright
  orange, with the overlap cut in a deeper third shade. The wordmark is set in the
  UI face, heavier, tracked tight -->
<template>
  <span class="inline-flex items-center gap-2.5 text-highlighted">
    <img
      v-if="logoSrc"
      :src="logoSrc"
      :alt="brand.name"
      :class="large ? 'h-11' : 'h-8'"
      class="w-auto"
    >
    <svg
      v-else
      :class="large ? 'size-11' : 'size-8'"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <clipPath :id="clip">
          <circle
            cx="12"
            cy="20"
            r="8.5"
          />
        </clipPath>
      </defs>
      <circle
        cx="12"
        cy="20"
        r="8.5"
        fill="#FDBA74"
      />
      <circle
        cx="20"
        cy="12"
        r="8.5"
        fill="#F97316"
      />
      <circle
        cx="20"
        cy="12"
        r="8.5"
        fill="#C2410C"
        :clip-path="`url(#${clip})`"
      />
    </svg>
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
