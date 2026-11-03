<script setup lang="ts">
defineProps<{
  title: string
  securityItems: { label: string, value: string }[]
}>()

const server = defineModel<ServerSettings>('server', { required: true })
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="w-full flex items-center justify-between mb-2 text-sm font-medium text-highlighted">
      {{ title }}
      <slot />
    </legend>

    <div class="grid grid-cols-[1fr_5.5rem] gap-2">
      <UInput
        v-model="server.host"
        placeholder="imap.example.com"
        aria-label="Server"
      />
      <UInputNumber
        v-model="server.port"
        :min="1"
        :max="65535"
        :increment="false"
        :decrement="false"
        :format-options="{ useGrouping: false }"
        aria-label="Port"
      />
    </div>
    <USelect
      v-model="server.security"
      :items="securityItems"
      aria-label="Security"
    />
  </fieldset>
</template>
