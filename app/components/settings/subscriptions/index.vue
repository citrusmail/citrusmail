<script setup lang="ts">
// Senders in your Inbox whose mail has an unsubscribe link, most frequent
// first, each left in one click (or on their own website, for a few)
const { subscriptions, shown, query, status, refresh, busy, leave, block } = useSubscriptions()
</script>

<template>
  <section class="flex flex-col gap-4">
    <div class="flex items-center gap-2">
      <UInput
        v-if="subscriptions.length > 8"
        v-model="query"
        icon="i-lucide-search"
        placeholder="Find a sender"
        class="max-w-sm"
      />
      <UButton
        label="Check again"
        icon="i-lucide-rotate-cw"
        color="neutral"
        variant="ghost"
        size="sm"
        class="ms-auto"
        :loading="status === 'pending'"
        @click="refresh()"
      />
    </div>

    <div
      v-if="status === 'pending' && !subscriptions.length"
      class="flex flex-col gap-2"
    >
      <USkeleton
        v-for="n in 6"
        :key="n"
        class="h-14 rounded-lg"
      />
    </div>
    <UEmpty
      v-else-if="!subscriptions.length"
      icon="i-lucide-newspaper"
      title="No mailing lists found"
      description="None of the recent mail in your Inbox has an unsubscribe link."
      variant="naked"
    />
    <ul
      v-else
      class="divide-y divide-default border-y border-default"
    >
      <SubscriptionRow
        v-for="item in shown"
        :key="item.address"
        :item="item"
        :busy="busy.has(item.address)"
        @unsubscribe="leave(item)"
        @block="block(item.address)"
      />
    </ul>
  </section>
</template>
