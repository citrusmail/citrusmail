<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const props = defineProps<{
  item: ScheduledMessage
}>()

const emit = defineEmits<{
  'edit': []
  'reschedule': []
  'reschedule-to': [date: Date]
  'cancel': []
}>()

const menu = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: 'Send at' }],
  sendLaterPresets().map(preset => ({ label: preset.label, description: scheduleLabel(preset.date.toISOString()), icon: preset.icon, onSelect: () => emit('reschedule-to', preset.date) })),
  [{ label: 'Custom time…', icon: 'i-lucide-calendar-clock', onSelect: () => emit('reschedule') }]
])

const failed = computed(() => props.item.status === 'failed')
</script>

<template>
  <li class="group flex items-center gap-3 ps-4 pe-2 py-2 border-t border-default first:border-t-0">
    <div class="flex-1 min-w-0">
      <p class="flex items-baseline gap-2 text-sm">
        <span class="truncate font-medium text-highlighted">
          <span class="text-muted font-normal">To </span>{{ item.to.map(personName).join(', ') || 'No recipients' }}
        </span>
        <span
          class="ms-auto shrink-0 text-xs tabular-nums"
          :class="failed ? 'text-error' : 'text-muted'"
        >{{ failed ? 'Not sent' : scheduleLabel(item.sendAt) }}</span>
      </p>
      <p class="text-sm text-toned truncate">
        {{ item.subject || '(No subject)' }}
      </p>
      <p
        v-if="failed"
        class="text-xs text-error truncate"
      >
        {{ item.error }}
      </p>
    </div>
    <div class="flex items-center shrink-0">
      <UDropdownMenu
        :items="menu"
        :content="{ align: 'end' }"
        :ui="{ content: 'min-w-64' }"
      >
        <UTooltip text="Change time">
          <UButton
            icon="i-lucide-calendar-clock"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Change time"
          />
        </UTooltip>
      </UDropdownMenu>
      <UTooltip text="Edit">
        <UButton
          icon="i-lucide-pen-line"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Edit"
          @click="emit('edit')"
        />
      </UTooltip>
      <UTooltip text="Don’t send">
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Don’t send"
          @click="emit('cancel')"
        />
      </UTooltip>
    </div>
  </li>
</template>
