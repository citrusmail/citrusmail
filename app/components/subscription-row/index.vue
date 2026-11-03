<script setup lang="ts">
const props = defineProps<{
  item: Subscription
  busy: boolean
}>()

const emit = defineEmits<{
  unsubscribe: []
  block: []
}>()

const when = computed(() => new Date(props.item.lastDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))
</script>

<template>
  <li class="flex items-center gap-3 py-3">
    <SenderAvatar
      :address="{ name: item.name, address: item.address }"
      size="md"
    />
    <div class="flex-1 min-w-0">
      <p class="font-medium text-highlighted truncate">
        {{ item.name || item.address }}
      </p>
      <p class="text-sm text-muted truncate">
        {{ item.count }} {{ item.count === 1 ? 'message' : 'messages' }}, latest {{ when }}<template v-if="item.name">
          — {{ item.address }}
        </template>
      </p>
    </div>

    <span
      v-if="item.unsubscribedAt"
      class="inline-flex items-center gap-1.5 text-sm text-success font-medium"
    >
      <UIcon
        name="i-lucide-check"
        class="size-4"
      />
      Unsubscribed
    </span>
    <template v-else>
      <UTooltip :text="UNSUBSCRIBE_HINT[item.method]">
        <UButton
          label="Unsubscribe"
          :trailing-icon="item.method === 'link' ? 'i-lucide-external-link' : undefined"
          color="neutral"
          variant="outline"
          size="sm"
          :loading="busy"
          @click="emit('unsubscribe')"
        />
      </UTooltip>
    </template>
    <UTooltip text="Block: their mail goes straight to Junk">
      <UButton
        icon="i-lucide-ban"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="`Block ${item.address}`"
        @click="emit('block')"
      />
    </UTooltip>
  </li>
</template>
