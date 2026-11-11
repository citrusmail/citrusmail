<script setup lang="ts">
const { status, saving, saveKey, use, remove } = useAiKeys()
</script>

<template>
  <div class="flex flex-col gap-6 max-w-2xl">
    <ul class="flex flex-col gap-3">
      <SettingsAiProvider
        v-for="item in status.providers"
        :key="item.provider"
        :item="item"
        :active="status.active === item.provider"
        :saving="saving === item.provider"
        @save="(key, model) => saveKey(item.provider, key, model)"
        @use="use(item.provider)"
        @remove="remove(item.provider)"
      />
    </ul>

    <p class="text-sm text-muted max-w-prose text-pretty">
      Keys are encrypted and stay on this server.
      When you use an AI feature, the message it needs goes straight from here to the provider you chose, under their terms. Nothing is sent until you ask.
    </p>
  </div>
</template>
