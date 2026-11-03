// Motion for the section switcher. The tabs take their new widths in one
// step, then every icon is slid from where it was to where it now sits
// (FLIP). Only transforms animate, so the browser runs all of it off the
// main thread and it stays smooth while the next page renders
export const SECTION_TABS_EASE = 'cubic-bezier(.32, .72, 0, 1)'
export const SECTION_TABS_MS = 280

export function useSectionTabsMotion(nav: Readonly<Ref<HTMLElement | null>>, active: Readonly<Ref<number>>) {
  // The tab being left keeps its name for the length of the move, wiping out
  const leaving = ref(-1)
  let before: number[] = []
  let timer: ReturnType<typeof setTimeout> | undefined

  const parts = () => [...(nav.value?.querySelectorAll<HTMLElement>('[data-flip]') ?? [])]
  const still = () => !import.meta.client || matchMedia('(prefers-reduced-motion: reduce)').matches
  const run = (el: Element | null | undefined, frames: Keyframe[], fill: FillMode = 'none') =>
    (el as HTMLElement | null)?.animate(frames, { duration: SECTION_TABS_MS, easing: SECTION_TABS_EASE, fill })

  // A name is uncovered by a mask sliding over it: the box slides one way and
  // the text inside the other, so the text holds still while the edge moves
  function wipe(box: Element | null | undefined, open: boolean) {
    const text = box?.firstElementChild
    const shut = [{ transform: 'translateX(-100%)' }, { transform: 'translateX(100%)' }] as const
    const fill: FillMode = open ? 'none' : 'forwards'
    run(box, open ? [shut[0], { transform: 'none' }] : [{ transform: 'none' }, shut[0]], fill)
    run(text, open ? [shut[1], { transform: 'none' }] : [{ transform: 'none' }, shut[1]], fill)
  }

  // Before the DOM changes: note where everything is, mid-animation included
  watch(active, (_, old) => {
    before = parts().map(el => el.getBoundingClientRect().left)
    parts().forEach(el => el.getAnimations().forEach(a => a.cancel()))
    leaving.value = old ?? -1
    clearTimeout(timer)
    timer = setTimeout(() => (leaving.value = -1), SECTION_TABS_MS)
  }, { flush: 'pre' })

  // After: start each part from its old place and let it travel to the new one
  watch(active, () => {
    if (still()) return void (leaving.value = -1)
    parts().forEach((el, i) => {
      const dx = (before[i] ?? 0) - el.getBoundingClientRect().left
      if (Math.abs(dx) > 0.5) run(el, [{ transform: `translateX(${dx}px)` }, { transform: 'none' }])
    })
    wipe(nav.value?.querySelector('[aria-current] [data-label]'), true)
    wipe(nav.value?.querySelector('[data-leaving]'), false)
  }, { flush: 'post' })

  onBeforeUnmount(() => clearTimeout(timer))
  return { leaving }
}
