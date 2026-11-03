<script setup lang="ts">
const { search, filters } = useMail()

const WITHIN_LABELS: Record<DateWithin, string> = { week: 'Past week', month: 'Past month', year: 'Past year' }

// What's narrowing the list, as chips you can take off one at a time
const chips = computed(() => [
  filters.value.from && { key: 'from' as const, icon: 'i-lucide-user', label: `From ${filters.value.from}` },
  filters.value.within && { key: 'within' as const, icon: 'i-lucide-calendar', label: WITHIN_LABELS[filters.value.within] },
  filters.value.on && { key: 'on' as const, icon: 'i-lucide-calendar-days', label: `On ${dayLabel(filters.value.on)}` },
  filters.value.attachments && { key: 'attachments' as const, icon: 'i-lucide-paperclip', label: 'Has attachments' }
].filter(Boolean) as { key: keyof MailFilters, icon: string, label: string }[])

function dayLabel(day: string) {
  const [year, month, date] = day.split('-').map(Number)
  const value = new Date(year!, month! - 1, date)
  return value.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: value.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
}

function drop(key: keyof MailFilters) {
  filters.value = { ...filters.value, [key]: undefined }
}

function clearAll() {
  search.value = ''
  filters.value = {}
}
</script>

<template>
  <div
    v-if="chips.length"
    class="flex flex-wrap items-center gap-1.5 px-4 pb-2.5 -mt-0.5"
  >
    <UBadge
      v-for="chip in chips"
      :key="chip.key"
      :icon="chip.icon"
      color="neutral"
      variant="soft"
      class="rounded-full ps-2.5 pe-1 gap-1.5 max-w-60"
    >
      <span class="truncate">{{ chip.label }}</span>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="link"
        size="xs"
        class="p-0.5"
        :aria-label="`Remove ${chip.label}`"
        @click="drop(chip.key)"
      />
    </UBadge>
    <UButton
      label="Clear"
      color="neutral"
      variant="link"
      size="xs"
      @click="clearAll"
    />
  </div>
</template>
