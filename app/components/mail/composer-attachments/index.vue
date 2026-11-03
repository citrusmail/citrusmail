<script setup lang="ts">
// Files going with the message: pictures as small previews, everything else as a chip
const { draft, detach } = useComposer()

const isPicture = (file: OutgoingAttachment) => /^image\/(png|jpe?g|gif|webp)$/.test(file.contentType)
</script>

<template>
  <TransitionGroup
    v-if="draft.attachments.length"
    tag="ul"
    name="lb-chip"
    class="flex flex-wrap gap-2 px-5 pb-3"
    aria-label="Attachments"
  >
    <li
      v-for="(file, index) in draft.attachments"
      :key="`${file.filename}-${index}`"
      class="group relative flex items-center gap-2 h-12 rounded-lg ring ring-default bg-default ps-1.5 pe-2 max-w-64"
    >
      <img
        v-if="isPicture(file)"
        :src="`data:${file.contentType};base64,${file.content}`"
        alt=""
        class="size-9 rounded-md object-cover shrink-0 bg-elevated"
      >
      <span
        v-else
        class="size-9 rounded-md bg-elevated grid place-items-center shrink-0"
      >
        <UIcon
          :name="attachmentIcon(file.contentType)"
          class="size-4.5 text-muted"
        />
      </span>
      <span class="min-w-0 flex flex-col leading-tight">
        <span class="truncate text-sm font-medium text-highlighted">{{ file.filename }}</span>
        <span class="text-xs text-muted tabular-nums">{{ formatSize(file.content.length * 0.75) }}</span>
      </span>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="solid"
        size="xs"
        :aria-label="`Remove ${file.filename}`"
        class="absolute -top-2 -end-2 rounded-full size-5 p-0 justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
        @click="detach(index)"
      />
    </li>
  </TransitionGroup>
</template>
