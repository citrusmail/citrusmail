<script setup lang="ts">
import type { SignInForm } from '~/composables/useSignIn'

const form = defineModel<SignInForm>('form', { required: true })
</script>

<template>
  <div class="flex flex-col gap-5">
    <UFormField
      label="Calendar (CalDAV)"
      description="Leave empty to skip the calendar."
    >
      <UInput
        v-model="form.caldav"
        type="url"
        placeholder="https://dav.example.com"
      />
    </UFormField>
    <UFormField
      label="Contacts (CardDAV)"
      description="Leave empty to skip contacts."
    >
      <UInput
        v-model="form.carddav"
        type="url"
        placeholder="https://dav.example.com"
      />
    </UFormField>
  </div>
</template>
