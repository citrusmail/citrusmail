<script setup lang="ts">
const { filters, filtering } = useMail()

const within = computed({
  get: () => filters.value.within ?? 'any',
  set: value => (filters.value = { ...filters.value, on: undefined, within: value === 'any' ? undefined : value as DateWithin })
})

const from = computed({
  get: () => filters.value.from ?? '',
  set: value => (filters.value = { ...filters.value, from: value || undefined })
})

const attachments = computed({
  get: () => !!filters.value.attachments,
  set: value => (filters.value = { ...filters.value, attachments: value || undefined })
})

const WITHIN = [
  { label: 'Any time', value: 'any' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' }
]
</script>

<template>
  <UPopover :content="{ align: 'end', sideOffset: 8 }">
    <UTooltip text="Filter">
      <UButton
        icon="i-lucide-sliders-horizontal"
        :color="filtering ? 'primary' : 'neutral'"
        :variant="filtering ? 'soft' : 'ghost'"
        size="xs"
        aria-label="Filter messages"
      />
    </UTooltip>

    <template #content>
      <div class="w-72 p-4 flex flex-col gap-4">
        <UFormField label="From">
          <UInput
            v-model="from"
            icon="i-lucide-user"
            placeholder="Name or address"
            autofocus
          />
        </UFormField>

        <UFormField label="Received">
          <UTabs
            v-model="within"
            :items="WITHIN"
            :content="false"
            color="neutral"
            size="xs"
          />
        </UFormField>

        <USwitch
          v-model="attachments"
          label="Has attachments"
        />
      </div>
    </template>
  </UPopover>
</template>
