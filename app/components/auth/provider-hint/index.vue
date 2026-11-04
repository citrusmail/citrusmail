<script setup lang="ts">
defineProps<{
  discovery: DiscoveryResult | null
}>()
</script>

<template>
  <UAlert
    v-if="discovery?.oauth && !discovery.oauthReady"
    icon="i-lucide-key-round"
    color="warning"
    variant="subtle"
    title="Microsoft mailboxes need Sign in with Microsoft"
    description="Microsoft no longer accepts passwords from mail apps, and this copy isn’t set up for Sign in with Microsoft yet. Whoever runs it can add it in a few minutes (see the README)."
  />
  <p
    v-else-if="discovery?.oauth"
    class="-mt-2 text-xs text-muted flex items-center gap-1.5"
  >
    <UIcon
      name="i-lucide-check"
      class="size-3.5 text-success"
    />
    {{ discovery.provider }} found. Microsoft signs you in on its own page, so there’s no password to type here.
  </p>
  <UAlert
    v-else-if="discovery?.appPasswordUrl"
    icon="i-lucide-key-round"
    color="neutral"
    variant="subtle"
    :title="`${discovery.provider} needs an app password`"
    description="Your normal password won’t work here. Create an app password and paste it below."
    :actions="[{ label: 'Create app password', to: discovery.appPasswordUrl, target: '_blank', trailingIcon: 'i-lucide-arrow-up-right', color: 'neutral', variant: 'outline', size: 'xs' }]"
  />
  <p
    v-else-if="discovery?.incoming"
    class="-mt-2 text-xs text-muted flex items-center gap-1.5"
  >
    <UIcon
      name="i-lucide-check"
      class="size-3.5 text-success"
    />
    {{ discovery.provider ? `${discovery.provider} found` : `Found ${discovery.incoming.host}` }}
  </p>
</template>
