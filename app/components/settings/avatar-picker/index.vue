<script setup lang="ts">
const brand = useBrand()
const { account } = useShell()
const { settings, save } = useSettings()
const toast = useToast()

const file = ref<File | null>(null)
const busy = ref(false)

// A centered square, 256px, as JPEG: small enough to keep, sharp on a retina screen
async function toSquare(source: File): Promise<string> {
  const bitmap = await createImageBitmap(source)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')!
  context.fillStyle = '#fff'
  context.fillRect(0, 0, 256, 256)
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.86)
}

watch(file, async (value) => {
  if (!value) return
  busy.value = true
  try {
    await save({ avatar: await toSquare(value) }, 'Picture updated')
  } catch {
    toast.add({ title: 'That picture couldn’t be read', description: 'Try a JPEG or PNG.', color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busy.value = false
    file.value = null
  }
})
</script>

<template>
  <div class="flex items-center gap-4">
    <UAvatar
      :src="settings.avatar"
      :alt="account?.name || account?.email"
      size="3xl"
      class="size-16 text-xl"
    />
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <UFileUpload
          v-slot="{ open }"
          v-model="file"
          accept="image/*"
          :preview="false"
          :dropzone="false"
          :interactive="false"
          :ui="{ root: 'w-auto' }"
        >
          <UButton
            :label="settings.avatar ? 'Change picture' : 'Add a picture'"
            icon="i-lucide-image-up"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="busy"
            @click="open()"
          />
        </UFileUpload>
        <UButton
          v-if="settings.avatar"
          label="Remove"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="save({ avatar: '' }, 'Picture removed')"
        />
      </div>
      <p class="text-xs text-muted">
        Shown on your messages and in {{ brand.name }}.
      </p>
    </div>
  </div>
</template>
