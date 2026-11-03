<script setup lang="ts">
// One of the ways tracking finds things out, and whether it's working here
defineProps<{
  icon: string
  title: string
  description: string
  on: boolean
}>()
</script>

<template>
  <li class="flex items-start gap-3 px-4 py-3">
    <span class="grid place-items-center size-9 shrink-0 rounded-lg bg-elevated ring ring-default">
      <UIcon
        :name="icon"
        class="size-[18px] text-toned"
      />
    </span>
    <div class="flex-1 min-w-0">
      <p class="font-medium text-highlighted">
        {{ title }}
      </p>
      <p class="text-sm text-muted text-pretty">
        {{ description }}
      </p>
    </div>
    <UBadge
      :label="on ? 'On' : 'Not set up'"
      :color="on ? 'success' : 'neutral'"
      :icon="on ? 'i-lucide-check' : undefined"
      variant="soft"
      size="sm"
      class="mt-1"
    />
  </li>
</template>
