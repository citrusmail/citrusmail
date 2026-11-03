import type { DAVCalendar } from 'tsdav'

type CalDav = DavSession<DAVCalendar>

export interface StoredObject {
  url: string
  data: string
  etag?: string
}

/** The object behind an event id: `<id>.ics`, or the bare name for servers that skip the extension */
export async function findEventObject(dav: CalDav, calendar: DAVCalendar, basename: string): Promise<StoredObject | null> {
  const withExtension = await getObject(dav, objectUrl(calendar, basename, '.ics'))
  if (withExtension) {
    return withExtension
  }

  return /\.[a-z]+$/i.test(basename) ? null : await getObject(dav, objectUrl(calendar, basename, ''))
}

/** Looks in the given calendars at once; the first hit wins */
export async function locateEvent(dav: CalDav, calendars: DAVCalendar[], basename: string): Promise<{ calendar: DAVCalendar, object: StoredObject } | null> {
  const found = await Promise.all(calendars.map(async calendar => ({ calendar, object: await findEventObject(dav, calendar, basename) })))
  const hit = found.find(entry => entry.object)

  return hit ? { calendar: hit.calendar, object: hit.object! } : null
}
