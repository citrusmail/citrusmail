<script setup lang="ts">
const brand = useBrand()
definePageMeta({ layout: 'auth' })
useSeoMeta({ title: 'Sign in' })

const signIn = useSignIn()
// The right half: your own image, nothing, or (when people pick their own
// server) the live connection card. A preconfigured app never shows the card
const panel = computed(() => {
  const image = brand.value.loginImage
  if (image === 'none') return 'none'
  if (image) return 'image'
  return signIn.locked.value ? 'none' : 'card'
})
</script>

<template>
  <div
    class="min-h-svh grid"
    :class="panel !== 'none' && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]'"
  >
    <section class="flex flex-col px-6 sm:px-12 py-8 in-[.desktop]:pt-14">
      <AppLogo />

      <div class="flex-1 flex items-center py-12">
        <AuthLoginForm
          :sign-in="signIn"
          class="w-full max-w-[25rem] mx-auto lg:mx-0 lg:ms-[max(0px,calc(50%-12.5rem))]"
        />
      </div>

      <p class="text-xs text-muted max-w-[25rem] mx-auto lg:mx-0 lg:ms-[max(0px,calc(50%-12.5rem))]">
        Your password goes only to your mail server. {{ brand.name }} keeps it in an encrypted cookie in this browser and stores nothing else.
      </p>
    </section>

    <section
      v-if="panel === 'image'"
      class="hidden lg:block relative bg-(--lb-desk) border-s border-default"
    >
      <img
        :src="brand.loginImage"
        alt=""
        class="absolute inset-0 size-full object-cover"
      >
    </section>
    <section
      v-else-if="panel === 'card'"
      class="hidden lg:flex items-center justify-center bg-(--lb-desk) border-s border-default p-12"
    >
      <AuthRoutingSlip
        :form="signIn.form"
        :discovery="signIn.discovery.value"
        :discovering="signIn.discovering.value"
        :submitting="signIn.submitting.value"
        :failed="!!signIn.error.value"
      />
    </section>
  </div>
</template>
