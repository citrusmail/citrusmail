<script setup lang="ts">
const { receipts, imageReady, set } = useTrackingSettings()

const tracked = computed({
  get: () => receipts.value.default,
  set: (value: boolean) => set({ default: value }, value ? 'New messages will be tracked' : 'New messages won’t be tracked')
})
</script>

<template>
  <div class="flex flex-col gap-8">
    <USwitch
      :model-value="imageReady && tracked"
      :disabled="!imageReady"
      label="Track new messages"
      :description="imageReady ? 'Each message can still be switched with the tracking button beside Attach. You’ll see Delivered, Opened or Bounced on it in Sent.' : 'Set up the tracking image below first. Until then, tracking stays off.'"
      @update:model-value="tracked = $event"
    />

    <section class="flex flex-col gap-3">
      <h2 class="text-sm font-semibold text-highlighted">
        What tracking uses
      </h2>
      <ul class="rounded-(--ui-radius) ring ring-default divide-y divide-default">
        <SettingsTrackingMethod
          icon="i-lucide-mail-check"
          title="Read receipt request"
          description="Asks the recipient’s mail app to say when it’s opened. Outlook and Apple Mail usually ask them first; Gmail never answers."
          :on="imageReady"
        />
        <SettingsTrackingMethod
          icon="i-lucide-server"
          title="Delivery report"
          description="Your mail server confirms when each recipient’s server accepts the message, or that it bounced. Asked only of servers that offer it."
          :on="imageReady"
        />
        <SettingsTrackingMethod
          icon="i-lucide-image"
          title="Tracking image"
          description="A tiny image the recipient’s app loads when it shows the message. Catches far more opens, including Gmail."
          :on="imageReady"
        />
      </ul>
      <p class="text-sm text-muted text-pretty">
        Receipts and delivery reports add nothing a spam filter looks at. The image is one small picture from your own address, with no redirects and no rewritten links, which is the lowest-risk way to track opens.
      </p>
    </section>

    <SettingsTrackingImage />
  </div>
</template>
