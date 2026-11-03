<script setup lang="ts">
const { draft, uploading, adjust, upload, remove, resetFilters } = useBackground()

const picker = useTemplateRef('picker')
function picked(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) upload(file)
  ;(event.target as HTMLInputElement).value = ''
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <input
      ref="picker"
      type="file"
      accept="image/*"
      class="hidden"
      @change="picked"
    >

    <div
      class="relative aspect-[16/9] w-full max-w-md overflow-hidden rounded-(--ui-radius) ring ring-default bg-(--lb-desk)"
      @dragover.prevent
      @drop.prevent="upload($event.dataTransfer!.files[0]!)"
    >
      <AppBackground
        v-if="draft"
        :preview="draft"
      />
      <!-- A sketch of the app over it: sidebar and sheet -->
      <div
        v-if="draft"
        class="absolute inset-y-3 end-3 start-[28%] rounded-md bg-default/95 ring ring-default shadow-sm"
      />
      <button
        v-else
        type="button"
        class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted border-2 border-dashed border-default rounded-(--ui-radius) hover:text-highlighted hover:border-accented transition-colors cursor-pointer"
        @click="picker?.click()"
      >
        <UIcon
          name="i-lucide-image-plus"
          class="size-6"
        />
        Choose a picture, or drop one here
      </button>
    </div>

    <div class="flex gap-2">
      <UButton
        :label="draft ? 'Replace' : 'Choose picture'"
        icon="i-lucide-upload"
        color="neutral"
        variant="outline"
        size="sm"
        :loading="uploading"
        @click="picker?.click()"
      />
      <UButton
        v-if="draft"
        label="Remove"
        icon="i-lucide-trash-2"
        color="neutral"
        variant="ghost"
        size="sm"
        @click="remove"
      />
    </div>

    <SettingsBackgroundAdjust
      v-if="draft"
      :background="draft"
      @adjust="adjust"
      @reset="resetFilters"
    />
  </div>
</template>
