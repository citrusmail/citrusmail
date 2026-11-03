<script setup lang="ts">
// Text that offers one action: the action's icon slides out on hover or
// focus, and swaps to a check for a moment once it's done
defineProps<{
  icon: string
  label?: string
  /** Show the done state: a check that pops in */
  done?: boolean
}>()

defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<template>
  <UButton
    color="neutral"
    variant="ghost"
    size="sm"
    class="group/reveal -mx-1.5 px-1.5 py-0.5 gap-0 font-normal text-[length:inherit] text-inherit hover:text-highlighted rounded-md"
    @click="$emit('click', $event)"
  >
    <slot>{{ label }}</slot>
    <span
      class="grid transition-[grid-template-columns,opacity] duration-200 ease-out motion-reduce:transition-none"
      :class="done ? 'grid-cols-[1fr] opacity-100' : 'grid-cols-[0fr] opacity-0 group-hover/reveal:grid-cols-[1fr] group-hover/reveal:opacity-100 group-focus-visible/reveal:grid-cols-[1fr] group-focus-visible/reveal:opacity-100'"
    >
      <span class="overflow-hidden flex">
        <UIcon
          :key="done ? 'done' : 'idle'"
          :name="done ? 'i-lucide-check' : icon"
          class="ms-1.5 size-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none"
          :class="done ? 'text-primary animate-[reveal-pop_260ms_ease-out]' : 'text-muted -translate-x-1 group-hover/reveal:translate-x-0 group-focus-visible/reveal:translate-x-0'"
        />
      </span>
    </span>
  </UButton>
</template>
