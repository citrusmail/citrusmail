// Two fingers sideways on a trackpad drag the sidebar between Mail, Calendar
// and Contacts (useSectionSlide), the way Arc drags between spaces.
//
// A browser only sees a trackpad as a stream of wheel events: no touch down,
// no touch up. After the fingers lift, macOS keeps the stream going with
// momentum, slowing smoothly to nothing. Momentum carries on the way the
// fingers went, so until it's recognised it simply moves the slide on, and
// where the slide lands doesn't depend on when the lift is noticed
// (useSectionSlide's `release`). Once the stream has slowed steadily for a
// moment, or stopped, the slide springs the rest of the way. Momentum after
// that is ignored, even after a pause, unless fingers speed up past it or
// turn round: a new swipe, which can come as soon as you like.
//
// Speeds are always taken over a few dozen milliseconds, never from one
// event to the next: events don't arrive evenly, and when the page is busy
// the browser holds them back and hands them over as one, so each event is
// spread over the time it stands for
const GAP = 60
/** The window speeds are measured over, in ms */
const SPAN = 40
/** Only a flick at least this fast (px/ms) leaves momentum behind it */
const FLICK = 0.3
/** Quiet this long, and nothing that follows can be the last swipe's momentum */
const TAIL = 900

type Mode = 'idle' | 'dragging' | 'coasting' | 'ignored'

/** One wheel event: how far, when, and the time it stands for */
interface Sample { dx: number, t: number, span: number }

function scrollsSideways(target: EventTarget | null, delta: number): boolean {
  for (let el = target as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth <= el.clientWidth + 1) continue
    const overflow = getComputedStyle(el).overflowX
    if (overflow !== 'auto' && overflow !== 'scroll') continue
    if (delta > 0 ? el.scrollLeft + el.clientWidth < el.scrollWidth - 1 : el.scrollLeft > 0) return true
  }
  return false
}

/** Pixels a millisecond between two moments, each event spread over its own span */
function rate(samples: Sample[], from: number, to: number, signed = true): number {
  let sum = 0
  for (const s of samples) {
    const overlap = Math.min(to, s.t) - Math.max(from, s.t - s.span)
    if (overlap > 0) sum += ((signed ? s.dx : Math.abs(s.dx)) * overlap) / s.span
  }
  return sum / (to - from)
}

const now = (samples: Sample[]) => samples.at(-1)!.t

/** How fast the fingers (or momentum) are going now, px/ms */
function speedOf(samples: Sample[]): number {
  return samples.length ? rate(samples, now(samples) - SPAN, now(samples)) : 0
}

/**
 * Momentum: after a real flick, slowing clearly and steadily across three
 * windows in a row, the same way throughout. Fingers easing off rarely slow
 * that evenly; if they do, the slide only springs on the way they were going
 * anyway
 */
function decaying(samples: Sample[]): boolean {
  const t = now(samples)
  if (samples[0]!.t - samples[0]!.span > t - 3 * SPAN) return false
  const [a, b, c] = [3, 2, 1].map(k => rate(samples, t - k * SPAN, t - (k - 1) * SPAN) * Math.sign(samples.at(-1)!.dx))
  // Momentum never loses half its speed in one window: fingers braking to
  // turn round or stop do, and they're still on the trackpad
  const steady = (later: number, earlier: number) => later <= earlier * 0.97 && later >= earlier * 0.5
  return a! >= FLICK && steady(b!, a!) && steady(c!, b!) && c! < a! * 0.85
}

/** Faster now than just before: fingers on the trackpad, since momentum only ever slows */
function speedingUp(samples: Sample[]): boolean {
  const t = now(samples)
  // Wider windows than elsewhere: uneven events can't fake it, and fingers
  // starting a swipe gather speed far faster than this asks
  const before = rate(samples, t - 2.5 * SPAN, t - 1.25 * SPAN, false)
  const after = rate(samples, t - 1.25 * SPAN, t, false)
  // and quickly, past anything a dying momentum tail still has
  return after > before * 1.5 + 0.15 && after > 0.35
}

export function useSectionSwipe() {
  const { section, isMobile } = useShell()
  const slide = useSectionSlide()

  let mode: Mode = 'idle'
  let samples: Sample[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastAt = -Infinity
  let lastSign = 0
  /** How many events in a row have come faster than the ones before */
  let quickening = 0
  /** This stream has moved the slide: whatever follows is its momentum until it clearly isn't */
  let touched = false
  /** Not ours at all (a pinch, a sideways scroller), or only until it turns sideways */
  let blocked = false
  let recent: { dx: number, dy: number }[] = []

  function release() {
    slide.release(speedOf(samples))
    mode = 'coasting'
  }

  // Stopped coming: the fingers lifted without a flick, or the momentum ran
  // out, or the page was busy for a moment and the stream will pick up again
  function quiet() {
    if (mode === 'dragging') release()
    mode = 'idle'
    recent = []
  }

  function grab(sample: Sample) {
    slide.grab()
    mode = 'dragging'
    samples = [sample]
    quickening = 0
    touched = true
  }

  /** Whether the slide can be swiped from where the fingers are */
  function usable(event: WheelEvent, dx: number) {
    // Pinch-zoom arrives as a wheel with ctrl held
    if (event.ctrlKey || isMobile.value || !SWIPE_SECTIONS.includes(section.value)) return false
    return !scrollsSideways(event.target, dx)
  }

  function onWheel(event: WheelEvent) {
    clearTimeout(timer)
    timer = setTimeout(quiet, GAP)
    const since = event.timeStamp - lastAt
    lastAt = event.timeStamp
    if (since >= TAIL) touched = false

    // Lines, not pixels: a mouse wheel tilted sideways
    const dx = event.deltaMode === 1 ? event.deltaX * 16 : event.deltaX
    const dy = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
    const sign = Math.sign(dx)
    const sample = { dx, t: event.timeStamp, span: Math.min(Math.max(since, 4), 250) }

    // Up and down is never ours: the page scrolls, swipe or no swipe
    const upright = Math.abs(dy) > Math.abs(dx) * 1.5 && Math.abs(dy) > 2
    if (mode === 'idle') {
      recent = []
      blocked = !usable(event, dx)
      // Momentum still arriving from a swipe that's done, even after a pause
      mode = !blocked && touched && !upright ? 'coasting' : 'ignored'
    } else if (mode === 'coasting' && upright) {
      mode = 'ignored'
      touched = false
    }

    if (mode === 'ignored') {
      if (blocked) return
      // A scroll that starts a little diagonal, or a list still coasting up
      // or down, gives way as soon as the fingers clearly go sideways
      recent.push({ dx, dy })
      if (recent.length > 3) recent.shift()
      const across = recent.reduce((sum, e) => sum + Math.abs(e.dx), 0)
      const down = recent.reduce((sum, e) => sum + Math.abs(e.dy), 0)
      if (across < 4 || across < down * 1.5) return
      grab(sample)
    } else if (mode === 'coasting') {
      event.preventDefault()
      samples.push(sample)
      while (samples.length > 1 && samples[0]!.t < sample.t - 3.5 * SPAN) samples.shift()
      // Fingers back on the trackpad speed up past the momentum, or turn it
      // round: a new swipe, from wherever the slide is heading, so swipes can
      // follow each other as fast as you like
      const turned = sign !== 0 && sign !== lastSign && Math.abs(dx) > 2
      quickening = speedingUp(samples) ? quickening + 1 : 0
      if (sign) lastSign = sign
      if (!turned && quickening < 2) return
      grab(sample)
    } else {
      samples.push(sample)
      while (samples[0]!.t < sample.t - 4 * SPAN) samples.shift()
    }

    // Ours now: the panels under the fingers don't scroll up and down with it
    event.preventDefault()
    if (sign) lastSign = sign

    if (decaying(samples)) return release()
    // All the way to the next section: chosen, and the rest of the swipe coasts
    if (slide.drag(dx)) mode = 'coasting'
  }

  useEventListener(window, 'wheel', onWheel, { passive: false })
  onBeforeUnmount(() => clearTimeout(timer))
}
