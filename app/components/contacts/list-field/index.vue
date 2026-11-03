<script setup lang="ts">
defineProps<{
  label: string
  type: 'email' | 'tel'
  addLabel: string
}>()

const model = defineModel<string[]>({ required: true })

function update(index: number, value: string) {
  model.value = model.value.map((item, i) => i === index ? value : item)
}
</script>

<template>
  <UFormField :label="label">
    <div class="flex flex-col gap-2">
      <UInput
        v-for="(value, index) in model"
        :key="index"
        :model-value="value"
        :type="type"
        :ui="{ trailing: 'pe-1' }"
        @update:model-value="update(index, String($event))"
      >
        <template #trailing>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="link"
            size="xs"
            :aria-label="`Remove ${label.toLowerCase()}`"
            @click="model = model.filter((_, i) => i !== index)"
          />
        </template>
      </UInput>
      <UButton
        icon="i-lucide-plus"
        :label="addLabel"
        color="neutral"
        variant="ghost"
        size="sm"
        class="self-start"
        @click="model = [...model, '']"
      />
    </div>
  </UFormField>
</template>
