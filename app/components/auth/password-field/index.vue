<script setup lang="ts">
const password = defineModel<string>({ required: true })
const shown = ref(false)
</script>

<template>
  <UFormField
    label="Password"
    name="password"
  >
    <UInput
      v-model="password"
      :type="shown ? 'text' : 'password'"
      autocomplete="current-password"
      size="xl"
      required
      :ui="{ trailing: 'pe-1.5' }"
    >
      <template #trailing>
        <UButton
          :icon="shown ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          :aria-label="shown ? 'Hide password' : 'Show password'"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="shown = !shown"
        />
      </template>
    </UInput>
  </UFormField>
</template>
