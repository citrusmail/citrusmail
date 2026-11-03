<script setup lang="ts">
const props = defineProps<{
  label: string
  description: string
  entries: string[]
  empty: string
  icon: string
}>()

const emit = defineEmits<{
  add: [entry: string]
  remove: [entry: string]
}>()

const input = ref('')
const valid = computed(() => /^(@[\w.-]+\.[a-z]{2,}|[^\s@]+@[\w.-]+\.[a-z]{2,})$/i.test(input.value.trim()))

function add() {
  if (!valid.value) return
  emit('add', input.value.trim())
  input.value = ''
}

const sorted = computed(() => [...props.entries].sort())
</script>

<template>
  <UFormField
    :label="label"
    :description="description"
  >
    <form
      class="flex gap-2 mt-2 max-w-md"
      @submit.prevent="add"
    >
      <UInput
        v-model="input"
        placeholder="name@example.com or @example.com"
        class="flex-1"
      />
      <UButton
        type="submit"
        label="Add"
        color="neutral"
        variant="outline"
        :disabled="!valid"
      />
    </form>
    <TransitionGroup
      tag="ul"
      name="lb-row"
      class="mt-3 max-w-md divide-y divide-default"
    >
      <li
        v-for="entry in sorted"
        :key="entry"
        class="flex items-center gap-2 py-1.5"
      >
        <UIcon
          :name="icon"
          class="size-4 text-muted shrink-0"
        />
        <span class="flex-1 min-w-0 truncate text-sm">{{ entry }}</span>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="`Remove ${entry}`"
          @click="emit('remove', entry)"
        />
      </li>
    </TransitionGroup>
    <p
      v-if="!entries.length"
      class="mt-3 text-sm text-dimmed"
    >
      {{ empty }}
    </p>
  </UFormField>
</template>
