<script setup lang="ts">
const { subscriptions, shown, query, status, refresh, busy, leave, block } = useSubscriptions()
useSeoMeta({ title: 'Subscriptions' })
</script>

<template>
  <PageSheet
    title="Subscriptions"
    description="Senders in your Inbox whose mail has an unsubscribe link, most frequent first. Most unsubscribe right here; a few only do it on their own website, which opens in a new tab."
  >
    <template #actions>
      <UTooltip text="Check again">
        <UButton
          icon="i-lucide-rotate-cw"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Check again"
          :loading="status === 'pending'"
          @click="refresh()"
        />
      </UTooltip>
    </template>

    <UInput
      v-if="subscriptions.length > 8"
      v-model="query"
      icon="i-lucide-search"
      placeholder="Find a sender"
      class="mb-4 max-w-sm"
    />

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
  </PageSheet>
</template>
