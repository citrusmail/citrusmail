// Motion for the section switcher. The tabs take their new widths in one
// step, then every icon is slid from where it was to where it now sits
// (FLIP). Only transforms and clip-paths animate, so the browser runs them
// off the main thread and they stay smooth while the next page renders
export const SECTION_TABS_EASE = 'cubic-bezier(.32, .72, 0, 1)'
export const SECTION_TABS_MS = 320

export function useSectionTabsMotion(nav: Readonly<Ref<HTMLElement | null>>, active: Readonly<Ref<number>>) {
  // The tab being left keeps its name for the length of the move, wiping out
  const leaving = ref(-1)
  let before: number[] = []
  let timer: ReturnType<typeof setTimeout> | undefined

  const parts = () => [...(nav.value?.querySelectorAll<HTMLElement>('[data-flip]') ?? [])]
  const still = () => !import.meta.client || matchMedia('(prefers-reduced-motion: reduce)').matches
  const run = (el: Element | null | undefined, frames: Keyframe[], fill: FillMode = 'none') =>
    (el as HTMLElement | null)?.animate(frames, { duration: SECTION_TABS_MS, easing: SECTION_TABS_EASE, fill })

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
    run(nav.value?.querySelector('[aria-current] [data-label]'), [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }])
    run(nav.value?.querySelector('[data-leaving]'), [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 100% 0 0)' }], 'forwards')
  }, { flush: 'post' })

  onBeforeUnmount(() => clearTimeout(timer))
  return { leaving }
}
