<script setup lang="ts">
// Tracks this message: asks for a read receipt and a delivery report and adds
// the tracking image. Off until Settings → Tracking has the image set up,
// since without it almost nothing ever reports back
const { draft } = useComposer()
const { settings } = useSettings()

const ready = computed(() => trackingReady(settings.value.receipts))
const on = computed(() => ready.value && (draft.value.readReceipt ?? settings.value.receipts?.default ?? false))
const tip = computed(() => !ready.value ? 'Tracking isn’t set up. Turn it on in Settings → Tracking' : on.value ? 'Tracking delivery and opens' : 'Track delivery and opens')
</script>

<template>
  <UTooltip :text="tip">
    <!-- A disabled button gets no hover, so the tooltip sits on this wrapper -->
    <span class="inline-flex">
      <UButton
        icon="i-lucide-mail-check"
        color="neutral"
        :variant="on ? 'soft' : 'ghost'"
        :disabled="!ready"
        :aria-pressed="on"
        aria-label="Track delivery and opens"
        :class="on && 'text-primary'"
        @click="draft.readReceipt = !on"
      />
    </span>
  </UTooltip>
</template>
