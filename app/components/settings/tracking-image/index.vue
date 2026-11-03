<script setup lang="ts">
// Sets up the tracking image: the address recipients' mail apps load it
// from, checked from the internet before it's turned on
const { receipts, imageReady, faivelo, desktop, local, address, checking, result, set, check } = useTrackingSettings()

const changed = computed(() => address.value.trim().replace(/\/+$/, '') !== receipts.value.origin)
</script>

<template>
  <section class="flex flex-col gap-4">
    <h2 class="text-sm font-semibold text-highlighted">
      Tracking image
    </h2>

    <p class="text-sm text-muted text-pretty">
      This is how most opens get noticed. When someone opens your message, their mail app downloads a tiny invisible picture, and that download is the “Opened”. The picture has to come from somewhere on the internet: {{ faivelo ? 'Faivelo, or' : '' }} CitrusMail at a web address of its own, like https://mail.yourdomain.com.
    </p>

    <SettingsTrackingFaivelo v-if="faivelo" />

    <UAlert
      v-else-if="(desktop || local) && !receipts.origin"
      icon="i-lucide-monitor"
      color="warning"
      variant="subtle"
      title="Not possible while CitrusMail runs on this computer"
      description="The people you write to can’t reach your computer, so the picture can’t be downloaded. Once CitrusMail is hosted at its own web address, open Settings there and set this up."
    />

    <!-- A Faivelo mailbox only needs its own address if that's what it already uses -->
    <template v-if="!desktop && (!faivelo || (receipts.provider === 'self' && receipts.origin))">
      <UFormField
        label="CitrusMail’s web address"
        description="The address you open CitrusMail at when it’s hosted. Check makes sure the picture can be downloaded from it."
      >
        <div class="flex gap-2 mt-1">
          <UInput
            v-model="address"
            placeholder="https://mail.example.com"
            icon="i-lucide-globe"
            class="flex-1"
            @keydown.enter="check"
          />
          <UButton
            :label="changed || !receipts.origin ? 'Check' : 'Check again'"
            :loading="checking"
            :disabled="!address.trim()"
            color="neutral"
            variant="outline"
            @click="check"
          />
        </div>
      </UFormField>

      <UAlert
        v-if="result"
        :icon="result.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'"
        :color="result.ok ? 'success' : 'warning'"
        variant="subtle"
        :description="result.message"
      />

      <USwitch
        :model-value="imageReady"
        :disabled="!receipts.origin || changed"
        label="Add the tracking image to tracked messages"
        :description="receipts.origin ? `Downloaded from ${receipts.origin}.` : 'Turns on once the address checks out.'"
        @update:model-value="set({ images: $event }, $event ? 'Tracking image is on' : 'Tracking image is off')"
      />

      <p class="text-sm text-muted text-pretty">
        Apple Mail and iCloud download every picture as soon as mail arrives, even unread, so for them it can only say “Maybe opened”. In the EU, people you write to may need to agree to being tracked.
      </p>
    </template>
  </section>
</template>
