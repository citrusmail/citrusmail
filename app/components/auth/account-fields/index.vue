<script setup lang="ts">
import type { SignInForm } from '~/composables/useSignIn'

const form = defineModel<SignInForm>('form', { required: true })
</script>

<template>
  <div class="flex flex-col gap-5">
    <UFormField
      label="Your name"
      description="Shown to the people you write to."
    >
      <UInput v-model="form.name" />
    </UFormField>
    <UFormField
      label="Username"
      description="Only if it isn’t your email address."
    >
      <UInput
        v-model="form.username"
        :placeholder="form.email || 'you@example.com'"
      />
    </UFormField>
  </div>
</template>
