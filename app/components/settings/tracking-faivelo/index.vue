<script setup lang="ts">
// For Faivelo mailboxes: Faivelo serves the tracking image, so it works
// from this computer too. One click checks Faivelo accepts the mailbox
const { receipts, set } = useTrackingSettings()
const checking = ref(false)
const failure = ref('')
const on = computed(() => receipts.value.provider === 'faivelo' && receipts.value.images)

async function turnOn() {
  checking.value = true
  failure.value = ''
  try {
    const result = await $fetch<{ ok: boolean, message: string }>('/api/receipts/faivelo', { method: 'POST' })
    if (result.ok) await set({ provider: 'faivelo', images: true }, 'Tracking is on')
    else failure.value = result.message
  } catch {
    failure.value = 'Faivelo couldn’t be reached. Check your connection and try again.'
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <section class="flex flex-col gap-3 rounded-(--ui-radius) ring ring-default p-4">
    <div class="flex items-start gap-3">
      <span class="grid place-items-center size-9 shrink-0 rounded-lg bg-primary/10 text-primary">
        <UIcon
          name="i-lucide-mail-check"
          class="size-5"
        />
      </span>
      <div class="flex-1 min-w-0">
        <p class="font-medium text-highlighted">
          Use Faivelo
        </p>
        <p class="text-sm text-muted text-pretty">
          Your mailbox is on Faivelo, so Faivelo can serve the image for you, the same way its own webmail tracks opens. Works straight away, also while CitrusMail runs on this computer.
        </p>
      </div>
      <UButton
        v-if="!on"
        label="Turn on"
        :loading="checking"
        @click="turnOn"
      />
      <USwitch
        v-else
        :model-value="true"
        aria-label="Track with Faivelo"
        @update:model-value="set({ images: false, provider: 'self' }, 'Tracking is off')"
      />
    </div>
    <UAlert
      v-if="failure"
      icon="i-lucide-circle-alert"
      color="warning"
      variant="subtle"
      :description="failure"
    />
  </section>
</template>
