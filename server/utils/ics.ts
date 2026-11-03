import ICAL from 'ical.js'
import { epochToLocal, floatingMs, localToEpoch, msToFloating, resolveZone } from './tz'

// Pure iCalendar <-> CalendarEvent conversion, no request context, so it can
// be exercised on its own

type Time = ICAL.Time
type Component = ICAL.Component

export interface FloatingRange {
  start: string
  end: string
}

// A recurrence rule that never ends would otherwise iterate forever when the
// range sits far in the future
const MAX_OCCURRENCES = 20000

const pad = (value: number, length = 2) => String(value).padStart(length, '0')

function wallClock(time: Time): string {
  return `${pad(time.year, 4)}-${pad(time.month)}-${pad(time.day)}T${pad(time.hour)}:${pad(time.minute)}:${pad(time.second)}`
}

function isUtc(time: Time): boolean {
  return time.zone === ICAL.Timezone.utcTimezone || time.zone?.tzid === 'UTC'
}

// A zone ical.js can convert with, i.e. backed by a VTIMEZONE in the object
function hasZoneData(time: Time): boolean {
  return !!time.zone && time.zone !== ICAL.Timezone.localTimezone && !isUtc(time) && !!time.zone.component
}

/**
 * An ICAL time as a floating local datetime in the viewer's zone. `tzid` is
 * the property's TZID, for objects that name an IANA zone without shipping
 * its VTIMEZONE (ical.js then treats the time as floating)
 */
export function timeToLocal(time: Time, zone: string, tzid?: string): string {
  if (time.isDate) {
    return `${wallClock(time).slice(0, 10)}T00:00:00`
  }
  if (isUtc(time)) {
    return epochToLocal(floatingMs(wallClock(time)), zone)
  }
  if (hasZoneData(time)) {
    return epochToLocal(time.toUnixTime() * 1000, zone)
  }

  const named = resolveZone(tzid)

  return named ? epochToLocal(localToEpoch(wallClock(time), named), zone) : wallClock(time)
}

function tzidOf(component: Component, name: string): string | undefined {
  const value = component.getFirstProperty(name)?.getParameter('tzid')

  return typeof value === 'string' ? value : undefined
}

export function parseCalendar(data: string): Component {
  return new ICAL.Component(ICAL.parse(data))
}

function toEvent(item: ICAL.Event, id: string, calendarId: string, zone: string, start: Time, end: Time, recurring: boolean): CalendarEvent {
  const startTzid = tzidOf(item.component, 'dtstart')
  const allDay = start.isDate
  const localStart = timeToLocal(start, zone, startTzid)
  let localEnd = timeToLocal(end, zone, tzidOf(item.component, 'dtend') ?? startTzid)

  if (allDay && localEnd <= localStart) {
    localEnd = msToFloating(floatingMs(localStart) + 86400000)
  }

  return {
    id,
    calendarId,
    title: item.summary || 'Untitled',
    ...(item.description ? { description: item.description } : {}),
    start: localStart,
    end: localEnd,
    ...(allDay ? { allDay: true } : {}),
    ...(recurring ? { recurring: true } : {})
  }
}

const overlaps = (event: CalendarEvent, range: FloatingRange) => event.start < range.end && event.end > range.start

/** Every event or occurrence of one calendar object that overlaps the range */
export function objectToEvents(data: string, basename: string, calendarId: string, range: FloatingRange, zone: string): CalendarEvent[] {
  const vevents = parseCalendar(data).getAllSubcomponents('vevent')
  const masters = vevents.filter(vevent => !vevent.hasProperty('recurrence-id'))
  const overrides = vevents.filter(vevent => vevent.hasProperty('recurrence-id'))
  const events: CalendarEvent[] = []

  for (const master of masters) {
    const event = new ICAL.Event(master, {
      exceptions: overrides.filter(override => override.getFirstPropertyValue('uid') === master.getFirstPropertyValue('uid'))
    })

    if (!event.isRecurring()) {
      const single = toEvent(event, basename, calendarId, zone, event.startDate, event.endDate, false)
      if (overlaps(single, range)) {
        events.push(single)
      }
      continue
    }

    const tzid = tzidOf(master, 'dtstart')
    const expansion = new ICAL.RecurExpansion({ component: master, dtstart: event.startDate })
    const seen = new Set<string>()

    for (let count = 0; count < MAX_OCCURRENCES; count++) {
      const next = expansion.next()
      if (!next) {
        break
      }

      const recurrenceId = timeToLocal(next, zone, tzid)
      if (recurrenceId >= range.end) {
        break
      }

      const details = event.getOccurrenceDetails(next)
      const occurrence = toEvent(details.item, `${basename}::${recurrenceId}`, calendarId, zone, details.startDate, details.endDate, true)
      seen.add(recurrenceId)
      if (overlaps(occurrence, range)) {
        events.push(occurrence)
      }
    }

    // An override moved into the range from an occurrence past its end
    for (const override of overrides) {
      const item = new ICAL.Event(override)
      if (item.uid !== event.uid) {
        continue
      }

      const recurrenceId = timeToLocal(item.recurrenceId, zone, tzidOf(override, 'recurrence-id'))
      const occurrence = toEvent(item, `${basename}::${recurrenceId}`, calendarId, zone, item.startDate, item.endDate, true)
      if (!seen.has(recurrenceId) && recurrenceId >= range.end && overlaps(occurrence, range)) {
        events.push(occurrence)
      }
    }
  }

  // Invited to a single occurrence: the server holds the override only
  const masterUids = new Set(masters.map(master => master.getFirstPropertyValue('uid')))
  for (const override of overrides) {
    if (masterUids.has(override.getFirstPropertyValue('uid'))) {
      continue
    }

    const item = new ICAL.Event(override)
    const recurrenceId = timeToLocal(item.recurrenceId, zone, tzidOf(override, 'recurrence-id'))
    const occurrence = toEvent(item, `${basename}::${recurrenceId}`, calendarId, zone, item.startDate, item.endDate, true)
    if (overlaps(occurrence, range)) {
      events.push(occurrence)
    }
  }

  return events
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

const DAY = 86400000

/** All-day ends are exclusive midnights; anything past midnight rounds up */
function allDayBounds(event: CalendarEvent): [string, string] {
  const start = event.start.slice(0, 10)
  let endMs = floatingMs(`${event.end.slice(0, 10)}T00:00:00`)
  if (event.end.slice(11, 19) !== '00:00:00') {
    endMs += DAY
  }
  endMs = Math.max(endMs, floatingMs(`${start}T00:00:00`) + DAY)

  return [start, msToFloating(endMs).slice(0, 10)]
}

/**
 * Timed values are written in UTC: ical.js cannot produce a VTIMEZONE from an
 * IANA name, and every server accepts `Z` times. An edit keeps the zone the
 * property already had when its VTIMEZONE is in the object
 */
function writeTime(local: string, zone: string, keep?: ICAL.Timezone): Time {
  const utc = ICAL.Time.fromJSDate(new Date(localToEpoch(local, zone)), true)

  return keep ? utc.convertToZone(keep) : utc
}

function setText(component: Component, name: string, value: string | undefined) {
  if (value) {
    component.updatePropertyWithValue(name, value)
  } else {
    component.removeAllProperties(name)
  }
}

function touch(component: Component) {
  const now = ICAL.Time.fromJSDate(new Date(), true)
  component.updatePropertyWithValue('dtstamp', now)
  component.updatePropertyWithValue('last-modified', now)

  if (component.hasProperty('sequence')) {
    component.updatePropertyWithValue('sequence', Number(component.getFirstPropertyValue('sequence')) + 1)
  }
}

function setTimes(item: ICAL.Event, event: CalendarEvent, zone: string) {
  const previous = item.component.hasProperty('dtstart') ? item.startDate : undefined
  const keep = previous && hasZoneData(previous) ? previous.zone : undefined
  const hadDuration = item.component.hasProperty('duration') && !item.component.hasProperty('dtend')

  let start: Time
  let end: Time
  if (event.allDay) {
    const [startDate, endDate] = allDayBounds(event)
    start = ICAL.Time.fromDateString(startDate)
    end = ICAL.Time.fromDateString(endDate)
  } else {
    start = writeTime(event.start, zone, keep)
    end = writeTime(event.end, zone, keep)
  }

  item.startDate = start
  if (hadDuration) {
    item.duration = end.subtractDate(start)
  } else {
    item.endDate = end
  }
}

/** A new VCALENDAR holding one event, its UID being the event id */
export function eventToCalendar(event: CalendarEvent, zone: string): string {
  const calendar = new ICAL.Component(['vcalendar', [], []])
  calendar.updatePropertyWithValue('prodid', '-//Letterbox//EN')
  calendar.updatePropertyWithValue('version', '2.0')

  const vevent = new ICAL.Component('vevent')
  calendar.addSubcomponent(vevent)
  vevent.updatePropertyWithValue('uid', event.id)
  vevent.updatePropertyWithValue('dtstamp', ICAL.Time.fromJSDate(new Date(), true))

  const item = new ICAL.Event(vevent)
  setText(vevent, 'summary', event.title)
  setText(vevent, 'description', event.description)
  setTimes(item, event, zone)

  return calendar.toString()
}

/** An object URL's file name, without `.ics`: the event id */
export function basenameOf(url: string): string {
  const last = url.replace(/\/+$/, '').split('/').pop() ?? ''
  let name = last
  try {
    name = decodeURIComponent(last)
  } catch {
    // Not percent-encoded after all
  }

  return name.replace(/\.ics$/i, '')
}

/** Splits `basename::recurrenceId` */
export function parseEventId(id: string): { basename: string, occurrence?: string } {
  const index = id.indexOf('::')

  return index === -1 ? { basename: id } : { basename: id.slice(0, index), occurrence: id.slice(index + 2) }
}

function findMaster(calendar: Component): Component | undefined {
  return calendar.getAllSubcomponents('vevent').find(vevent => !vevent.hasProperty('recurrence-id'))
}

function findOverride(calendar: Component, occurrence: string, zone: string): Component | undefined {
  return calendar.getAllSubcomponents('vevent').find(vevent =>
    vevent.hasProperty('recurrence-id')
    && timeToLocal(new ICAL.Event(vevent).recurrenceId, zone, tzidOf(vevent, 'recurrence-id')) === occurrence)
}

/** The series' own time for an occurrence id, by expanding the master */
function findOccurrence(master: Component, occurrence: string, zone: string): Time | undefined {
  const event = new ICAL.Event(master)
  const tzid = tzidOf(master, 'dtstart')
  const expansion = new ICAL.RecurExpansion({ component: master, dtstart: event.startDate })

  for (let count = 0; count < MAX_OCCURRENCES; count++) {
    const next = expansion.next()
    if (!next) {
      return undefined
    }

    const local = timeToLocal(next, zone, tzid)
    if (local === occurrence) {
      return next
    }
    if (local > occurrence) {
      return undefined
    }
  }
}

function shiftValues(component: Component, name: string, apply: (time: Time) => void) {
  for (const property of component.getAllProperties(name)) {
    const values = property.getValues().map((value: Time) => {
      const time = value.clone()
      apply(time)

      return time
    })
    if (property.isMultiValue) {
      property.setValues(values)
    } else {
      property.setValue(values[0])
    }
  }
}

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

// Moving a weekly series to another weekday moves its BYDAY with it, or the
// rule would keep generating the old days
function shiftWeekdays(master: Component, days: number) {
  if (!days) {
    return
  }

  for (const property of master.getAllProperties('rrule')) {
    const rule = property.getFirstValue() as ICAL.Recur
    if (rule.freq !== 'WEEKLY' || !rule.parts.BYDAY?.length) {
      continue
    }

    rule.parts.BYDAY = rule.parts.BYDAY.map((day: string) => {
      const index = WEEKDAYS.indexOf(day)

      return index === -1 ? day : WEEKDAYS[(index + days + 7) % 7]!
    })
    property.setValue(rule)
  }
}

function editSeries(calendar: Component, master: Component, occurrence: string, event: CalendarEvent, zone: string) {
  const item = new ICAL.Event(master)
  const oldSummary = item.summary
  const oldDescription = item.description

  setText(master, 'summary', event.title)
  setText(master, 'description', event.description)
  for (const vevent of calendar.getAllSubcomponents('vevent')) {
    if (vevent === master || vevent.getFirstPropertyValue('uid') !== item.uid) {
      continue
    }
    if (vevent.getFirstPropertyValue('summary') === oldSummary) {
      setText(vevent, 'summary', event.title)
    }
    if (vevent.getFirstPropertyValue('description') === oldDescription) {
      setText(vevent, 'description', event.description)
    }
  }

  // Wall-clock delta in the viewer's zone, applied to the master in its own
  // zone so the series keeps its local time across DST
  const delta = floatingMs(event.start) - floatingMs(occurrence)
  const duration = floatingMs(event.end) - floatingMs(event.start)
  const oldStart = item.startDate
  const hadDuration = master.hasProperty('duration') && !master.hasProperty('dtend')
  let start: Time

  if (!!event.allDay === oldStart.isDate) {
    const shift = (time: Time) => oldStart.isDate
      ? time.adjust(Math.round(delta / DAY), 0, 0, 0)
      : time.adjust(0, 0, 0, Math.round(delta / 1000))

    start = oldStart.clone()
    shift(start)
    if (delta) {
      // Keeps EXDATEs and overrides pointing at the occurrences they meant
      shiftValues(master, 'exdate', shift)
      shiftValues(master, 'rdate', shift)
      for (const vevent of calendar.getAllSubcomponents('vevent')) {
        if (vevent.getFirstPropertyValue('uid') === item.uid) {
          shiftValues(vevent, 'recurrence-id', shift)
        }
      }
      shiftWeekdays(master, start.dayOfWeek() - oldStart.dayOfWeek())
    }
  } else {
    // All-day toggled: rebuild from the master's first start as the viewer
    // sees it, moved by the same delta
    const masterLocal = msToFloating(floatingMs(timeToLocal(oldStart, zone, tzidOf(master, 'dtstart'))) + delta)
    start = event.allDay ? ICAL.Time.fromDateString(masterLocal.slice(0, 10)) : writeTime(masterLocal, zone)
  }

  const end = start.clone()
  if (start.isDate) {
    end.adjust(Math.max(1, Math.round(duration / DAY)), 0, 0, 0)
  } else {
    end.adjust(0, 0, 0, Math.round(duration / 1000))
  }

  item.startDate = start
  if (hadDuration) {
    item.duration = end.subtractDate(start)
  } else {
    item.endDate = end
  }
  touch(master)
}

/**
 * Applies an edit to an existing object, keeping every property we do not
 * manage (attendees, alarms, RRULE...). An occurrence id edits the series
 */
export function patchCalendar(data: string, id: string, event: CalendarEvent, zone: string): string {
  const calendar = parseCalendar(data)
  const { occurrence } = parseEventId(id)
  const master = findMaster(calendar)

  if (occurrence && master && new ICAL.Event(master).isRecurring()) {
    editSeries(calendar, master, occurrence, event, zone)

    return calendar.toString()
  }

  const target = (occurrence && !master ? findOverride(calendar, occurrence, zone) : master) ?? calendar.getFirstSubcomponent('vevent')
  if (!target) {
    throw new Error('No event in calendar object')
  }

  setText(target, 'summary', event.title)
  setText(target, 'description', event.description)
  setTimes(new ICAL.Event(target), event, zone)
  touch(target)

  return calendar.toString()
}

/**
 * Removes one occurrence: an EXDATE on the master, and its override if any.
 * Returns null when nothing is left and the whole object should go
 */
export function excludeOccurrence(data: string, occurrence: string, zone: string): string | null {
  const calendar = parseCalendar(data)
  const master = findMaster(calendar)

  const override = findOverride(calendar, occurrence, zone)
  if (override) {
    calendar.removeSubcomponent(override)
  }

  if (master) {
    const time = findOccurrence(master, occurrence, zone)
    if (time) {
      const property = new ICAL.Property('exdate', master)
      property.setValue(time.clone())
      const tzid = hasZoneData(time) ? time.zone.tzid : tzidOf(master, 'dtstart')
      if (tzid && !time.isDate && !isUtc(time)) {
        property.setParameter('tzid', tzid)
      }
      master.addProperty(property)
      touch(master)
    }
  }

  return calendar.getAllSubcomponents('vevent').length ? calendar.toString() : null
}
