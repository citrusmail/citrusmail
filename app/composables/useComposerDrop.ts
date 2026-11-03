import type { Editor } from '@tiptap/vue-3'

const MAX_INLINE = 1600

/** A picture as a data URL, scaled down so a phone photo doesn't weigh 8 MB */
async function inlineImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_INLINE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size < 1.5 * 1024 * 1024 && file.type !== 'image/heic') {
    return `data:${file.type};base64,${await blobToBase64(file)}`
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.86)
}

const isImage = (file: File) => /^image\/(png|jpe?g|gif|webp)$/.test(file.type)

/**
 * Files dragged over the composer. Pictures can go in the message itself or
 * on as attachments, depending on which half they're dropped on; anything else
 * is attached. Pasted pictures go in the message
 */
export function useComposerDrop(editor: () => Editor | undefined) {
  const { attach } = useComposer()
  const dragging = ref(false)
  const images = ref(0)
  const files = ref(0)
  let depth = 0

  const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files')

  function onEnter(event: DragEvent) {
    if (!carriesFiles(event)) return
    event.preventDefault()
    depth++
    dragging.value = true
    const items = Array.from(event.dataTransfer?.items ?? []).filter(item => item.kind === 'file')
    files.value = items.length
    images.value = items.filter(item => /^image\/(png|jpe?g|gif|webp)$/.test(item.type)).length
  }

  function onOver(event: DragEvent) {
    if (carriesFiles(event)) event.preventDefault()
  }

  function onLeave() {
    depth = Math.max(0, depth - 1)
    if (!depth) dragging.value = false
  }

  async function insert(list: File[]) {
    const chain = editor()?.chain().focus()
    if (!chain) return
    for (const file of list) chain.setImage({ src: await inlineImage(file), alt: file.name })
    chain.run()
  }

  async function onDrop(event: DragEvent, target: 'inline' | 'attach') {
    event.preventDefault()
    depth = 0
    dragging.value = false
    const dropped = Array.from(event.dataTransfer?.files ?? [])
    if (!dropped.length) return
    const pictures = target === 'inline' ? dropped.filter(isImage) : []
    const rest = dropped.filter(file => !pictures.includes(file))
    if (pictures.length) await insert(pictures)
    if (rest.length) await attach(rest)
  }

  /** For the editor's paste: pictures from the clipboard go in the message */
  function onPaste(event: ClipboardEvent) {
    const pictures = Array.from(event.clipboardData?.files ?? []).filter(isImage)
    if (!pictures.length) return false
    insert(pictures)
    return true
  }

  return { dragging, images, files, onEnter, onOver, onLeave, onDrop, onPaste }
}
