<script setup lang="ts">
// The edge between the list and the message. Drag to make the list a little
// wider or narrower, double-click to put it back. Arrow keys work too
const { listWidth, resize, persistWidth } = useMailLayout()

const dragging = ref(false)
let startX = 0
let startWidth = 0

function onDown(event: PointerEvent) {
  dragging.value = true
  startX = event.clientX
  startWidth = listWidth.value
  ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
}

function onMove(event: PointerEvent) {
  if (dragging.value) resize(startWidth + event.clientX - startX)
}

function onUp() {
  if (!dragging.value) return
  dragging.value = false
  persistWidth()
}

function onKey(event: KeyboardEvent) {
  const step = event.shiftKey ? 40 : 16
  if (event.key === 'ArrowLeft') resize(listWidth.value - step)
  else if (event.key === 'ArrowRight') resize(listWidth.value + step)
  else return
  event.preventDefault()
  persistWidth()
}

function reset() {
  resize(LIST_WIDTH.default)
  persistWidth()
}
</script>

<template>
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize the message list"
    :aria-valuenow="listWidth"
    :aria-valuemin="LIST_WIDTH.min"
    :aria-valuemax="LIST_WIDTH.max"
    tabindex="0"
    class="group relative z-10 w-px shrink-0 bg-(--ui-border) cursor-col-resize outline-none touch-none select-none"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @dblclick="reset"
    @keydown="onKey"
  >
    <!-- A wider grip than the hairline, and a line that shows where it is -->
    <span class="absolute inset-y-0 -inset-x-1.5" />
    <span
      class="absolute inset-y-0 -start-px w-[3px] rounded-full bg-primary opacity-0 transition-opacity duration-150 group-hover:opacity-60 group-focus-visible:opacity-100"
      :class="dragging && 'opacity-100!'"
    />
  </div>
</template>
