<script setup lang="ts">
// Settings → Reading: every one-key shortcut with its own switch
const { all, isOn, set } = useShortcutSwitches()
const groups = SHORTCUT_GROUPS.map(group => ({ title: group.title, items: group.items.filter(item => item.id) }))
</script>

<template>
  <div
    class="mt-4 grid sm:grid-cols-2 gap-x-10 gap-y-6 transition-opacity duration-200 motion-reduce:transition-none"
    :class="!all && 'opacity-50'"
  >
    <section
      v-for="group in groups"
      :key="group.title"
    >
      <h3 class="text-sm font-semibold text-highlighted mb-1">
        {{ group.title }}
      </h3>
      <ul class="divide-y divide-default">
        <li
          v-for="item in group.items"
          :key="item.id"
          class="flex items-center gap-3 py-2 text-sm"
        >
          <span class="flex-1 min-w-0 truncate text-default">{{ item.label }}</span>
          <ShortcutKeys :keys="item.keys" />
          <USwitch
            :model-value="isOn(item.id)"
            :disabled="!all"
            size="sm"
            :aria-label="item.label"
            @update:model-value="set(item.id!, $event)"
          />
        </li>
      </ul>
    </section>
  </div>
</template>
