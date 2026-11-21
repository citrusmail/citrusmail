<script setup lang="ts">
// Text with the words being searched for marked, as you type
const props = defineProps<{
  text: string
  /** Mark words found inside other words too, as file names are matched */
  anywhere?: boolean
}>()
const { terms } = useMail()
const parts = computed(() => highlightParts(props.text, terms.value, props.anywhere))
</script>

<template>
  <template
    v-for="(part, i) in parts"
    :key="i"
  >
    <!-- eslint-disable-next-line vue/max-attributes-per-line, vue/singleline-html-element-content-newline -- a line break here would add spaces inside words -->
    <mark v-if="part.hit" class="rounded-[3px] bg-(--lb-search-mark) text-inherit">{{ part.text }}</mark><template v-else>{{ part.text }}</template>
  </template>
</template>
