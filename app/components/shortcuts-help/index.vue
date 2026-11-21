<script setup lang="ts">
const { isOpen } = useShortcutsHelp()
const { all: shortcuts, isOn } = useShortcutSwitches()
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
            :class="!isOn(item.id) && 'opacity-50'"
          >
            <span class="min-w-0 truncate">{{ item.label }}</span>
            <span class="shrink-0 flex items-center gap-2">
              <span
                v-if="!isOn(item.id)"
                class="text-xs"
              >Off</span>
              <ShortcutKeys :keys="item.keys" />
            </span>
          </li>
        </ul>
      </section>
    </template>
    <template #footer>
      <USwitch
        v-model="shortcuts"
        label="One-key shortcuts"
        description="Off, single keys do nothing. Arrows, Delete and anything with ⌘ or Ctrl still work. Settings → Reading has a switch for each one."
      />
    </template>
  </UModal>
</template>
