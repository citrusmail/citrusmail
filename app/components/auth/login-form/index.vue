<script setup lang="ts">
const brand = useBrand()
const props = defineProps<{
  signIn: ReturnType<typeof useSignIn>
}>()

const { form, adding, locked, discovery, discovering, advancedOpen, touched, error, submitting, submit, oauth, oauthUrl } = props.signIn

// A Microsoft mailbox takes no password: the button hands over to Microsoft,
// unless the person opened the server settings to use their own servers
const viaOauth = computed(() => !!oauth.value && !advancedOpen.value && !touched.value)
const oauthReady = computed(() => viaOauth.value && !!discovery.value?.oauthReady)

const leadingIcon = computed(() => discovering.value ? 'i-lucide-loader-circle' : discovery.value?.icon ?? 'i-lucide-at-sign')
</script>

<template>
  <div class="flex flex-col gap-8">
    <header>
      <h1 class="text-[2rem] leading-[1.1] font-bold tracking-[-0.03em] text-highlighted text-balance">
        {{ adding ? 'Add a mailbox' : brand.loginTitle }}
      </h1>
      <p class="mt-3 text-[15px] leading-relaxed text-toned text-pretty">
        {{ adding ? 'Sign in to another address. You can switch between them from the menu at the bottom of the sidebar.' : brand.loginSubtitle }}
      </p>
    </header>

    <UForm
      :state="form"
      class="flex flex-col gap-5"
      @submit="submit"
    >
      <UFormField
        label="Email address"
        name="email"
      >
        <UInput
          v-model="form.email"
          type="email"
          autocomplete="username"
          placeholder="you@example.com"
          size="xl"
          autofocus
          required
          :icon="leadingIcon"
          :ui="{ leadingIcon: discovering ? 'animate-spin text-dimmed' : discovery?.icon ? 'text-highlighted' : 'text-dimmed' }"
        />
      </UFormField>

      <AuthProviderHint :discovery="discovery" />

      <AuthPasswordField
        v-if="!viaOauth"
        v-model="form.password"
      />

      <UAlert
        v-if="error"
        icon="i-lucide-circle-alert"
        color="error"
        variant="subtle"
        :description="error"
      />

      <UButton
        v-if="oauthReady"
        :label="adding ? 'Add with Microsoft' : 'Sign in with Microsoft'"
        icon="i-simple-icons-microsoft"
        size="xl"
        block
        class="mt-1"
        :href="oauthUrl"
        external
      />
      <UButton
        v-else-if="!viaOauth"
        type="submit"
        :label="submitting ? 'Connecting' : adding ? 'Add mailbox' : 'Sign in'"
        size="xl"
        block
        :loading="submitting"
        class="mt-1"
      />

      <UButton
        v-if="adding"
        label="Back to your mail"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="link"
        size="sm"
        to="/mail/INBOX"
        class="self-center -mt-2"
      />

      <UButton
        v-if="!locked"
        label="Enter server settings yourself"
        icon="i-lucide-sliders-horizontal"
        color="neutral"
        variant="link"
        size="sm"
        class="self-center"
        @click="advancedOpen = true"
      />
    </UForm>

    <AuthServerSettings
      v-if="!locked"
      v-model:open="advancedOpen"
      v-model:form="form"
      @touch="touched = true"
    />
  </div>
</template>
