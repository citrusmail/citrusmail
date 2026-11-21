<script setup lang="ts">
// A new message or a draft: a panel docked in the corner that leaves the rest
// of the app usable, so you can read, search and copy from other mail while
// you write. It folds down to a bar, or opens out large (the app dimmed
// behind) for a long message. Small screens give it the whole screen
const { open: shown, asking, draft, version, minimized, expanded } = useComposer()

const title = computed(() => {
  const subject = draft.value.subject.trim()
  if (subject) return subject
  if (draft.value.inReplyTo) return 'Reply'
  return draft.value.savedAs ? 'Draft' : 'New message'
})

// Clicking anywhere else folds it down to its bar. Not for menus, dialogs
// or toasts it opened, nor a click that's closing one of them, nor a drag
// that started inside it, nor a click that started another message
let outside: number | undefined
useEventListener(document, 'pointerdown', (event: PointerEvent) => {
  const target = event.target as Element | null
  const inside = target?.closest('[data-composer-dock], [data-reka-popper-content-wrapper], [role="dialog"], [role="alertdialog"], [role="region"] > ol[data-slot="viewport"]')
  // With a menu or dialog open (Send later, a custom time), a click outside
  // it only closes that
  // (a tooltip showing doesn't count)
  const dismissing = document.querySelector('[data-reka-popper-content-wrapper]:has([role="menu"], [role="listbox"], [role="dialog"]), [role="dialog"]:not([data-composer-dock]), [role="alertdialog"]')
  outside = shown.value && !minimized.value && !inside && !dismissing ? version.value : undefined
}, { capture: true })
useEventListener(document, 'pointerup', () => {
  const at = outside
  outside = undefined
  if (at === undefined) return
  setTimeout(() => {
    if (shown.value && !asking.value && version.value === at) minimized.value = true
  })
}, { capture: true })

// A sheet held just off the desk, like an answer in reply-stage: lifted on
// layered shadows, clear of the window's edges, every corner rounded
const frame = computed(() => {
  if (minimized.value) return 'sm:w-80 sm:bottom-4 sm:end-4'
  if (expanded.value) return 'sm:w-[min(56rem,calc(100vw-4rem))] sm:h-[min(52rem,calc(100dvh-4rem))] sm:inset-0 sm:m-auto'
  return 'sm:w-[40rem] sm:min-h-[min(26rem,calc(100dvh-2rem))] sm:max-h-[min(44rem,calc(100dvh-2rem))] sm:bottom-4 sm:end-4'
})
</script>

<template>
  <Teleport to="body">
    <Transition name="lb-fade">
      <div
        v-if="shown && expanded && !minimized"
        class="fixed inset-0 z-30 bg-neutral-950/20 max-sm:hidden"
        aria-hidden="true"
      />
    </Transition>
    <Transition name="lb-dock">
      <section
        v-if="shown"
        data-composer-dock
        role="dialog"
        :aria-label="title"
        class="fixed z-40 max-sm:inset-0 flex flex-col overflow-hidden bg-default sm:rounded-xl lb-frame-raised"
        :class="frame"
      >
        <MailComposerDockHeader :title="title" />
        <MailComposerForm
          v-show="!minimized"
          :from="false"
        />
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.lb-dock-enter-active {
  transition: opacity 200ms ease-out, translate 420ms var(--ease-spring), scale 420ms var(--ease-spring);
}
.lb-dock-leave-active {
  transition: opacity 160ms ease-in, translate 220ms var(--ease-sheet), scale 220ms var(--ease-sheet);
}
.lb-dock-enter-from,
.lb-dock-leave-to {
  opacity: 0;
  translate: 0 24px;
  scale: .98;
}
.lb-fade-enter-active,
.lb-fade-leave-active {
  transition: opacity 180ms ease;
}
.lb-fade-enter-from,
.lb-fade-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .lb-dock-enter-active,
  .lb-dock-leave-active {
    transition: opacity 120ms ease;
  }
  .lb-dock-enter-from,
  .lb-dock-leave-to {
    translate: none;
    scale: none;
  }
}
</style>
