const DEFAULT_BACKGROUND: Omit<BackgroundSettings, 'version'> = { blur: 0, brightness: 100, saturation: 100, filter: 'none' }

/** A picture made small enough to keep: at most 2560px across, as JPEG */
async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}

// Settings → Appearance → Background. Slider changes show at once and save a moment later
export function useBackground() {
  const { settings, save } = useSettings()
  const toast = useToast()
  const uploading = ref(false)
  const draft = ref<BackgroundSettings | undefined>(settings.value.appearance?.background)
  watch(() => settings.value.appearance?.background, value => (draft.value = value))

  const persist = useDebounceFn(() => save({ appearance: { ...settings.value.appearance, background: draft.value } }, false), 600)

  function adjust(patch: Partial<BackgroundSettings>) {
    if (!draft.value) return
    draft.value = { ...draft.value, ...patch }
    // The real background follows along, so you see it behind the page too
    settings.value = { ...settings.value, appearance: { ...settings.value.appearance, background: draft.value } }
    persist()
  }

  async function upload(file: File) {
    if (!file.type.startsWith('image/')) return
    uploading.value = true
    try {
      await $fetch('/api/background', { method: 'PUT', body: { image: await shrink(file) } })
      const background = { ...DEFAULT_BACKGROUND, ...draft.value, version: Date.now() }
      await save({ appearance: { ...settings.value.appearance, background } }, 'Background set')
    } catch (error) {
      const description = (error as { data?: { message?: string } }).data?.message ?? 'Try a JPEG or PNG under 20 MB.'
      toast.add({ title: 'That picture couldn’t be used', description, color: 'error', icon: 'i-lucide-image-off' })
    } finally {
      uploading.value = false
    }
  }

  async function remove() {
    await save({ appearance: { ...settings.value.appearance, background: undefined } }, 'Background removed')
    $fetch('/api/background', { method: 'PUT', body: { image: '' } }).catch(() => {})
  }

  function resetFilters() {
    adjust(DEFAULT_BACKGROUND)
  }

  return { draft, uploading, adjust, upload, remove, resetFilters }
}
