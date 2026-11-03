<script setup lang="ts">
const { isOpen } = useShortcutsHelp()
</script>

<template>
  <UModal
    v-model:open="isOpen"
    title="Keyboard shortcuts"
    :ui="{ content: 'sm:max-w-2xl', body: 'grid sm:grid-cols-2 gap-6' }"
  >
    <template #body>
      <section
        v-for="group in SHORTCUT_GROUPS"
        :key="group.title"
      >
        <h3 class="text-sm font-semibold text-highlighted mb-2">
          {{ group.title }}
        </h3>
        <ul class="flex flex-col gap-1.5">
          <li
            v-for="item in group.items"
            :key="item.label"
            class="flex items-center justify-between gap-4 text-sm text-muted"
          >
            <span>{{ item.label }}</span>
            <span class="flex items-center gap-0.5">
              <UKbd
                v-for="key in item.keys"
                :key="key"
                :value="key"
                variant="soft"
              />
            </span>
          </li>
        </ul>
      </section>
    </template>
  </UModal>
</template>
