// Where Mail, Calendar and Contacts sit, as one number: 0 is Mail, 1 is
// Calendar, 2 is Contacts, and 0.4 is a finger's way from Mail to Calendar.
// The sidebars ride on it side by side and the section tabs are drawn from
// it, so a drag, a flick and a click all move them as one piece.
//
// Fingers move it directly (`grab`, `drag`, `release`). Dragged all the way
// to the next section, that's where it stays and the page opens at once.
// Let go before that and a spring carries it on with the speed the fingers
// had, critically damped so it never runs past where it's going; it can be
// grabbed again mid-flight
/** The spring's natural frequency: higher settles sooner */
const OMEGA = 30
/** The sidebar moves this much for each pixel the fingers do */
const GAIN = 0.8
/** A swipe at least this far along goes on to the next section... */
const NUDGE = 0.12
/** ...unless the fingers came back more than this from the furthest they got... */
const BACKOFF = 0.08
/** ...and aren't still past this much of the way */
const COMMIT = 0.4
/** Or were heading back faster than this (sections a second) when they let go */
const TURNING = 0.35

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const indexOf = (section: Section) => SWIPE_SECTIONS.indexOf(section)

const _useSectionSlide = () => {
  const { section, lastPaths } = useShell()
  const reduceMotion = usePreferredReducedMotion()

  const start = Math.max(indexOf(section.value), 0)
  /** What's drawn: the tabs and the sidebar track read this every frame */
  const position = ref(start)
  const dragging = ref(false)
  /** Wide enough for one sidebar: a drag of this many pixels is one section */
  const width = ref(272)

  let target = start
  let velocity = 0
  let raf = 0
  let last = 0
  let arrived = true

  // While dragging: where the fingers have taken it, and the one section
  // either way this swipe can reach
  let raw = start
  let home = start
  let low = 0
  let high = SWIPE_SECTIONS.length - 1
  /** The furthest from home this swipe has got, either way */
  let peak = 0

  // The next section's page, loaded before it's asked for
  function preload(index: number) {
    const next = SWIPE_SECTIONS[index]
    if (next && next !== section.value) preloadRouteComponents(lastPaths.value[next]).catch(() => {})
  }
  onNuxtReady(() => SWIPE_SECTIONS.forEach((_, i) => preload(i)))

  // The page changes once the slide has landed. Drawing a whole new page
  // takes a few frames however well it's prepared, and with nothing moving
  // by then, those frames can't show as a stutter
  function arrive() {
    arrived = true
    const next = SWIPE_SECTIONS[target]
    if (next && next !== section.value) navigateTo(lastPaths.value[next])
  }

  function step(now: number) {
    const elapsed = Math.min((now - last) / 1000, 1 / 30)
    last = now
    const steps = Math.max(1, Math.ceil(elapsed * 240))
    const h = elapsed / steps
    let x = position.value
    for (let i = 0; i < steps; i++) {
      velocity += (-OMEGA * OMEGA * (x - target) - 2 * OMEGA * velocity) * h
      x += velocity * h
    }
    position.value = x

    // Within a pixel or so it's there: the spring's long tail is cut, so the
    // page doesn't wait on motion nobody can see
    if (Math.abs(x - target) < 0.004 && Math.abs(velocity) < 0.3) {
      position.value = target
      velocity = 0
      raf = 0
      if (!arrived) arrive()
      return
    }
    raf = requestAnimationFrame(step)
  }

  function animateTo(index: number, from: number) {
    target = clamp(index, 0, SWIPE_SECTIONS.length - 1)
    const distance = target - position.value
    // Heading for the target any faster than the spring itself would carry it
    // means sailing past and coming back; keep under that. Moving away from
    // it, the fingers' speed would carry it further out before it turned
    // round, so it starts from rest instead
    velocity = Math.sign(from) === Math.sign(distance) ? clamp(from, -Math.abs(distance) * OMEGA, Math.abs(distance) * OMEGA) : 0
    arrived = false
    if (reduceMotion.value === 'reduce' || (Math.abs(distance) < 0.004 && Math.abs(velocity) < 0.15)) {
      cancelAnimationFrame(raf)
      raf = 0
      position.value = target
      velocity = 0
      return arrive()
    }
    if (!raf) {
      last = performance.now()
      raf = requestAnimationFrame(step)
    }
  }

  /**
   * Fingers down: it stops wherever it is, mid-flight included. Each swipe
   * reaches one section either way, counted from where it was heading
   */
  function grab() {
    cancelAnimationFrame(raf)
    raf = 0
    dragging.value = true
    raw = position.value
    home = arrived ? Math.round(position.value) : target
    low = Math.max(0, home - 1)
    high = Math.min(SWIPE_SECTIONS.length - 1, home + 1)
    peak = raw - home
    preload(low)
    preload(high)
  }

  /**
   * Fingers moved this many pixels (positive: towards the next section).
   * True once they've brought the next section all the way in: it's chosen
   * there and then, and the rest of the swipe has nothing left to move
   */
  function drag(pixels: number): boolean {
    // Kept within reach, so turning back from an end moves it at once
    raw = clamp(raw + (pixels * GAIN) / width.value, low, high)
    const reached = (raw >= high && high > home) ? high : (raw <= low && low < home) ? low : undefined
    if (reached !== undefined) {
      dragging.value = false
      position.value = reached
      animateTo(reached, 0)
      return true
    }
    // Mail and Contacts are hard stops: nothing to pull past and spring back from
    position.value = raw
    if (Math.abs(raw - home) > Math.abs(peak)) peak = raw - home
    return false
  }

  /** Fingers up, moving at this many pixels a millisecond */
  function release(pixelsPerMs: number) {
    if (!dragging.value) return
    dragging.value = false
    const speed = (pixelsPerMs * 1000 * GAIN) / width.value
    // Pushed against Mail or Contacts, there's no speed left to carry
    const outside = raw <= low || raw >= high
    // Like Arc: a swipe goes where it was heading, unless the fingers pulled
    // it back. Nothing here hangs on how fast they were going at the very
    // end, which a browser can only guess at: momentum running down to
    // nothing, or a lift read a moment early or late, lands it the same
    const progress = raw - home
    const way = Math.sign(progress)
    const backoff = Math.sign(peak) === way ? Math.abs(peak) - Math.abs(progress) : Math.abs(peak) + Math.abs(progress)
    const turning = Math.sign(speed) === -way && Math.abs(speed) > TURNING
    const goesOn = !turning && Math.abs(progress) > NUDGE && (backoff < BACKOFF || Math.abs(progress) > COMMIT)
    const aim = clamp(goesOn ? home + way : home, low, high)
    animateTo(aim, outside ? 0 : speed)
  }

  /** A click on a tab: the same slide a swipe ends in */
  function goTo(next: Section) {
    const index = indexOf(next)
    if (index === -1) return navigateTo(lastPaths.value[next])
    preload(index)
    animateTo(index, 0)
  }

  // Arriving any other way (a link, Back): the sidebar slides to match
  watch(section, (now) => {
    const index = indexOf(now)
    if (index === -1 || dragging.value || index === target) return
    animateTo(index, 0)
  })

  /** The section the slide is heading for, before the page has caught up */
  const heading = computed(() => SWIPE_SECTIONS[Math.round(position.value)] ?? section.value)

  return { position, dragging, width, heading, grab, drag, release, goTo }
}

export const useSectionSlide = createAppComposable(_useSectionSlide)
