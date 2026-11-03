<script setup lang="ts">
const condition = defineModel<RuleCondition>({ required: true })

defineProps<{
  removable: boolean
}>()

const emit = defineEmits<{
  remove: []
}>()

const PLACEHOLDERS: Record<RuleField, string> = {
  from: 'receipts@shop.com or shop.com',
  to: 'team@company.com',
  subject: 'Invoice'
}
</script>

<template>
  <div class="flex items-center gap-2">
    <USelect
      v-model="condition.field"
      :items="RULE_FIELDS"
      class="w-28 shrink-0"
      :ui="{ base: 'w-28' }"
    />
    <span class="text-sm text-muted shrink-0">contains</span>
    <UInput
      v-model="condition.value"
      :placeholder="PLACEHOLDERS[condition.field]"
      class="flex-1 min-w-0"
    />
    <UButton
      v-if="removable"
      icon="i-lucide-x"
      color="neutral"
      variant="ghost"
      size="sm"
      aria-label="Remove condition"
      @click="emit('remove')"
    />
  </div>
</template>
