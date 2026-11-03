<script setup lang="ts">
const toast = useToast()
const { fetch: refreshSession } = useUserSession()

const { data, status } = useFetch('/api/account', { server: false })

const state = reactive({ name: '', caldav: '', carddav: '' })
watch(data, (value) => {
  if (value) Object.assign(state, { name: value.name, caldav: value.caldav, carddav: value.carddav })
}, { immediate: true })

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    await $fetch('/api/account', { method: 'PATCH', body: state })
    await refreshSession()
    toast.add({ title: 'Profile saved', icon: 'i-lucide-check' })
    // Calendar and contacts lists were fetched for the old addresses
    await refreshNuxtData()
  } catch (error) {
    const message = (error as { data?: { message?: string } }).data?.message
    toast.add({ title: 'Couldn’t save', description: message, color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <SettingsAvatarPicker />

    <USkeleton
      v-if="status === 'pending' && !data"
      class="h-48"
    />

    <UForm
      v-else
      :state="state"
      class="flex flex-col gap-6"
      @submit="save"
    >
      <UFormField
        label="Your name"
        description="Shown next to your address on mail you send."
      >
        <UInput
          v-model="state.name"
          :placeholder="data?.email"
        />
      </UFormField>

      <template v-if="!data?.locked">
        <UFormField
          label="Calendar address (CalDAV)"
          description="Leave empty to turn the calendar off."
        >
          <UInput
            v-model="state.caldav"
            type="url"
            placeholder="https://dav.example.com"
          />
        </UFormField>
        <UFormField
          label="Contacts address (CardDAV)"
          description="Leave empty to turn contacts off."
        >
          <UInput
            v-model="state.carddav"
            type="url"
            placeholder="https://dav.example.com"
          />
        </UFormField>
      </template>

      <dl
        v-if="data"
        class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm rounded-lg ring ring-default px-4 py-3"
      >
        <dt class="text-muted">
          Address
        </dt>
        <dd class="text-toned truncate">
          {{ data.email }}
        </dd>
        <dt class="text-muted">
          Incoming
        </dt>
        <dd class="text-toned truncate">
          {{ data.incoming.host }}:{{ data.incoming.port }} ({{ data.incoming.protocol.toUpperCase() }})
        </dd>
        <dt class="text-muted">
          Outgoing
        </dt>
        <dd class="text-toned truncate">
          {{ data.outgoing.host }}:{{ data.outgoing.port }} (SMTP)
        </dd>
      </dl>

      <UButton
        type="submit"
        label="Save profile"
        :loading="saving"
        class="self-start"
      />
    </UForm>
  </div>
</template>
