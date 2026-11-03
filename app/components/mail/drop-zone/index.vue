<script setup lang="ts">
// What shows while files are dragged over the composer: one target to attach,
// or two when there are pictures, which can go in the message itself
const props = defineProps<{
  drop: ReturnType<typeof useComposerDrop>
}>()

const split = computed(() => props.drop.images.value > 0)
const noun = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`
</script>

<template>
  <Transition name="lb-drop">
    <div
      v-if="drop.dragging.value"
      class="absolute inset-2 z-20 grid gap-2 rounded-xl"
      :class="split ? 'grid-cols-2' : 'grid-cols-1'"
    >
      <div
        v-if="split"
        class="lb-drop-target"
        @dragover.prevent
        @drop.stop.prevent="drop.onDrop($event, 'inline')"
      >
        <UIcon
          name="i-lucide-image-plus"
          class="size-8"
        />
        <p class="font-semibold text-highlighted">
          Put in the message
        </p>
        <p class="text-sm text-muted">
          {{ noun(drop.images.value, 'picture') }}, where the cursor is
        </p>
      </div>
      <div
        class="lb-drop-target"
        @dragover.prevent
        @drop.stop.prevent="drop.onDrop($event, 'attach')"
      >
        <UIcon
          name="i-lucide-paperclip"
          class="size-8"
        />
        <p class="font-semibold text-highlighted">
          Attach
        </p>
        <p class="text-sm text-muted">
          {{ noun(drop.files.value, 'file') }}, sent with the message
        </p>
      </div>
    </div>
  </Transition>
</template>
