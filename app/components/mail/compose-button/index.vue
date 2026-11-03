<script setup lang="ts">
defineProps<{
  /** The sidebar is folded to icons */
  collapsed?: boolean
}>()

const { compose } = useComposer()
</script>

<template>
  <UTooltip
    :text="collapsed ? 'New message' : undefined"
    :disabled="!collapsed"
    :kbds="['c']"
    :content="{ side: 'right' }"
  >
    <UButton
      icon="i-lucide-pen-line"
      :label="collapsed ? undefined : 'New message'"
      :block="!collapsed"
      :square="collapsed"
      aria-label="New message"
      :class="collapsed ? 'self-center' : 'justify-start'"
      @click="compose()"
    >
      <template
        v-if="!collapsed"
        #trailing
      >
        <UKbd
          value="c"
          class="hidden lg:inline-flex ms-auto bg-white/15 text-white ring-0"
        />
      </template>
    </UButton>
  </UTooltip>
</template>
