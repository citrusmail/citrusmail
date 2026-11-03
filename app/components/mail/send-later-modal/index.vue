<script setup lang="ts">
import type { CalendarDate, Time } from '@internationalized/date'

// Pick exactly when a message goes out: a day on the calendar and a time
const props = defineProps<{
  /** Where the picker starts; an hour from now if not given */
  initial?: Date
  action?: string
}>()

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ pick: [date: Date] }>()

const day = shallowRef<CalendarDate>()
const time = shallowRef<Time>()
watch(open, (value) => {
  if (!value) return
  const start = props.initial && props.initial.getTime() > Date.now() ? props.initial : inAnHour()
  day.value = toCalendarDate(start)
  time.value = toTime(start)
}, { immediate: true })

const when = computed(() => day.value && time.value ? toDateTime(day.value, time.value) : undefined)
const valid = computed(() => !!when.value && when.value.getTime() > Date.now() + 60_000)

function confirm() {
  if (!valid.value) return
  open.value = false
  emit('pick', when.value!)
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Send later"
    description="It goes out at this time, even if CitrusMail is closed."
    :ui="{ content: 'sm:max-w-sm', footer: 'justify-end' }"
  >
    <template #body>
      <form
        class="flex flex-col items-center gap-4"
        @submit.prevent="confirm"
      >
        <UCalendar
          v-model="day"
          :min-value="todayDate()"
          :week-starts-on="1"
          size="sm"
        />
        <div class="flex items-center gap-3 w-full">
          <UInputTime
            v-model="time"
            aria-label="Time"
            class="flex-1"
          />
          <span class="text-sm text-muted text-end flex-1">
            {{ valid ? scheduleLabel(when!.toISOString()) : 'Pick a later time' }}
          </span>
        </div>
      </form>
    </template>
    <template #footer>
      <UButton
        label="Cancel"
        color="neutral"
        variant="ghost"
        @click="open = false"
      />
      <UButton
        :label="action ?? 'Schedule'"
        icon="i-lucide-clock-arrow-up"
        :disabled="!valid"
        @click="confirm"
      />
    </template>
  </UModal>
</template>
