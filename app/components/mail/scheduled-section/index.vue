<script setup lang="ts">
// At the top of Drafts: what's waiting to go out, to change, edit or cancel
const { scheduled, cancel, reschedule } = useScheduled()
const { reopen } = useComposer()
const toast = useToast()
const open = useLocalStorage('citrusmail-scheduled-open', true)

const picking = ref<ScheduledMessage>()
const pickerOpen = computed({
  get: () => !!picking.value,
  set: (value) => {
    if (!value) picking.value = undefined
  }
})

async function edit(item: ScheduledMessage) {
  const message = await cancel(item)
  if (message) reopen(message)
}

async function drop(item: ScheduledMessage) {
  if (await cancel(item)) toast.add({ title: 'Won’t be sent', description: item.subject || '(No subject)', icon: 'i-lucide-x' })
}

function moveTo(date: Date) {
  if (picking.value) reschedule(picking.value, date)
}
</script>

<template>
  <section
    v-if="scheduled.length"
    class="shrink-0 border-b border-default bg-elevated/40"
  >
    <UButton
      :label="`Scheduled (${scheduled.length})`"
      icon="i-lucide-clock-arrow-up"
      :trailing-icon="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
      color="neutral"
      variant="ghost"
      size="sm"
      block
      class="justify-start rounded-none px-4 h-9 text-muted font-semibold"
      :ui="{ trailingIcon: 'ms-auto' }"
      :aria-expanded="open"
      @click="open = !open"
    />
    <div
      class="lb-expand"
      :data-open="open || undefined"
      :inert="!open"
    >
      <ul class="max-h-64 overflow-y-auto">
        <MailScheduledItem
          v-for="item in scheduled"
          :key="item.id"
          :item="item"
          @edit="edit(item)"
          @reschedule="picking = item"
          @reschedule-to="date => reschedule(item, date)"
          @cancel="drop(item)"
        />
      </ul>
    </div>

    <MailSendLaterModal
      v-model:open="pickerOpen"
      :initial="picking ? new Date(picking.sendAt) : undefined"
      action="Reschedule"
      @pick="moveTo"
    />
  </section>
</template>
