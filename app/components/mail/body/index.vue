<script setup lang="ts">
const props = defineProps<{
  message: MessageDetail
  /** The reader chose to show remote images */
  remote?: boolean
}>()

const emit = defineEmits<{
  /** The text is on screen (again), for AI Translate to work on */
  rendered: []
}>()

const colorMode = useColorMode()
const frame = useTemplateRef('frame')
const plain = useTemplateRef('plain')
const height = ref(0)
const ready = ref(false)

// On a white sheet the message sits straight on the page. On anything else
// (dark mode, a tinted theme) it gets a white page of its own, since mail
// HTML is written for white
const sheetIsWhite = ref(true)
function checkSheet() {
  const probe = document.createElement('div')
  probe.style.background = 'var(--ui-bg)'
  document.body.appendChild(probe)
  sheetIsWhite.value = /^rgba?\(255, 255, 255(, 1)?\)$/.test(getComputedStyle(probe).backgroundColor)
  probe.remove()
}
onMounted(checkSheet)
watch(() => colorMode.value, () => nextTick(checkSheet))
const paper = computed(() => !sheetIsWhite.value)

// Text the sender didn't style uses the app's own font and accent
function token(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

// The frame's own policy is what keeps remote content out until the reader
// asks for it: no scripts, no connections, images only from the message itself
const policy = computed(() => {
  const remote = props.remote ? ' https: http:' : ''
  return `default-src 'none'; img-src 'self' data: cid:${remote}; style-src 'unsafe-inline'; font-src data:${remote}; media-src 'none'; form-action 'none'`
})

const srcdoc = computed(() => `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy.value}"><meta charset="utf-8"><base target="_blank">
<meta name="color-scheme" content="light">
<style>
  html,body{margin:0;padding:0;background:#fff;color:#1c1917;overflow-y:hidden}
  html{overflow-x:hidden}
  body{overflow:visible}
  body{display:flow-root;font:15px/1.6 ${token('--font-sans', 'system-ui, sans-serif')};padding:${paper.value ? '24px' : '0'};overflow-wrap:anywhere;-webkit-font-smoothing:antialiased}
  img{max-width:100%;height:auto}
  a{color:${token('--ui-color-primary-600', '#0C7A57')}}
  blockquote{margin:0 0 0 .25em;padding-left:1em;border-left:2px solid #d6d3d1;color:#57534e}
  pre{white-space:pre-wrap}
</style></head><body><div id="lb-root">${props.message.html ?? ''}</div></body></html>`)

let observer: ResizeObserver | undefined

function onLoad() {
  const doc = frame.value?.contentDocument
  const root = frame.value
  if (!doc || !root) return

  // Height from the body, never from the frame (which would never shrink),
  // and a newsletter wider than the reader is scaled down, not scrolled
  const content = doc.getElementById('lb-root')!
  // Shrinking past this makes the text too small to read; a wider message
  // scrolls sideways on its own instead. `zoom` (unlike a transform) changes
  // the layout size, so the body's height is the height to show
  const MIN_SCALE = 0.75
  const measure = () => {
    content.style.zoom = ''
    const padding = paper.value ? 48 : 0
    const fit = Math.min(1, (root.clientWidth - padding) / content.scrollWidth)
    const scale = Math.max(fit, MIN_SCALE)
    if (scale < 1) content.style.zoom = String(scale)
    doc.documentElement.style.overflowX = fit < MIN_SCALE ? 'auto' : 'hidden'
    const scrollbar = doc.documentElement.offsetHeight - doc.documentElement.clientHeight
    height.value = Math.ceil(doc.body.getBoundingClientRect().height + Math.max(0, scrollbar))
    ready.value = true
  }
  measure()
  emit('rendered')

  // Keys pressed while reading inside the message still reach the app's
  // shortcuts (r to reply, j for the next message)
  doc.addEventListener('keydown', (event) => {
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: event.key, code: event.code, metaKey: event.metaKey, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey }))
  })

  observer?.disconnect()
  observer = new ResizeObserver(() => requestAnimationFrame(measure))
  observer.observe(content)
  observer.observe(root)
  // Images arriving late change the height
  doc.querySelectorAll('img').forEach(img => img.addEventListener('load', measure, { once: true }))
}

watch(srcdoc, () => (ready.value = false))
onBeforeUnmount(() => observer?.disconnect())

// A plain-text message, a paragraph per block, so translation can swap each
const paragraphs = computed(() => (props.message.text || 'This message has no text.').split(/\n{2,}/))
onMounted(() => !props.message.html && nextTick(() => emit('rendered')))
watch(() => props.message.text, () => !props.message.html && nextTick(() => emit('rendered')))

defineExpose({
  /** Where the message's text lives: inside the frame, or on the page */
  root: () => props.message.html ? frame.value?.contentDocument?.getElementById('lb-root') ?? undefined : plain.value ?? undefined
})
</script>

<template>
  <div
    v-if="message.html"
    class="transition-opacity duration-150 motion-reduce:transition-none"
    :class="[paper && 'rounded-lg bg-white overflow-hidden', ready ? 'opacity-100' : 'opacity-0']"
  >
    <iframe
      ref="frame"
      :key="paper ? 'paper' : 'flat'"
      :srcdoc="srcdoc"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerpolicy="no-referrer"
      title="Message body"
      scrolling="no"
      class="block w-full border-0"
      :style="{ height: `${height || 120}px` }"
      @load="onLoad"
    />
  </div>

  <div
    v-else
    ref="plain"
    class="flex flex-col gap-[1lh] text-[15px] leading-relaxed text-default"
  >
    <p
      v-for="(paragraph, index) in paragraphs"
      :key="index"
      class="whitespace-pre-wrap break-words"
      v-text="paragraph"
    />
  </div>
</template>
