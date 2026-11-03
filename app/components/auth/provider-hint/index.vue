<script setup lang="ts">
defineProps<{
  discovery: DiscoveryResult | null
}>()
</script>

<template>
  <UAlert
    v-if="discovery?.appPasswordUrl"
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
