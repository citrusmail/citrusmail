<script setup lang="ts">
const brand = useBrand()
const route = useRoute()
const router = useRouter()
const { rules, status, edit, toggle, remove } = useRules()

// "Filter mail into this folder" from a folder's menu lands here
onMounted(() => {
  const folder = route.query.folder as string | undefined
  if (!folder) return
  router.replace({ query: {} })
  edit(undefined, folder)
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <USkeleton
      v-if="status === 'pending' && !rules.length"
      class="h-32"
    />

    <UEmpty
      v-else-if="!rules.length"
      icon="i-lucide-list-filter"
      title="No rules yet"
      description="A rule moves mail out of your Inbox as it arrives, like receipts into a Receipts folder."
      :actions="[{ label: 'New rule', icon: 'i-lucide-plus', onClick: () => edit() }]"
      variant="outline"
    />

    <template v-else>
      <ul class="rounded-lg ring ring-default divide-y divide-default">
        <SettingsRuleRow
          v-for="rule in rules"
          :key="rule.id"
          :rule="rule"
          @edit="edit(rule)"
          @toggle="toggle(rule, $event)"
          @remove="remove(rule)"
        />
      </ul>
      <UButton
        label="New rule"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        class="self-start"
        @click="edit()"
      />
    </template>

    <p class="text-xs text-muted">
      Rules run on your Inbox each time {{ brand.name }} checks for mail, on any device where it’s open.
    </p>
  </div>
</template>
