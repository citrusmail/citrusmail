import { defineEventHandler, getQuery, getRouterParam, readValidatedBody } from 'nuxt/server'

// Upsert on purpose: an event created offline reaches the server as a PATCH
// when the client replays its queue. `from` is the calendar the event was in
// before the edit; without it every calendar is searched
export default defineEventHandler(async (event): Promise<CalendarEvent> => {
  const id = getRouterParam(event, 'id', { decode: true })!
  const body = await readValidatedBody(event, eventSchema)
  const { from } = getQuery<{ from?: string }>(event)
  const dav = await useCalDav(await requireAccount(event))
  if (!dav) {
    throw notSetUp('caldav')
  }

  const zone = viewerZone(event)
  const { basename } = parseEventId(id)
  const target = findCollection(dav, body.calendarId)
  const source = from ? findCollection(dav, from) : target

  const found = await locateEvent(dav, [source], basename)
    ?? (from ? null : await locateEvent(dav, dav.collections.filter(calendar => calendar !== source), basename))

  if (!found) {
    await putObject(dav, objectUrl(target, basename, '.ics'), eventToCalendar({ ...body, id: basename }, zone))

    return { ...body, id }
  }

  const updated = patchCalendar(found.object.data, id, body, zone)

  if (found.calendar === target) {
    await putObject(dav, found.object.url, updated, found.object.etag, true)
  } else {
    // Moved: written to the new calendar first, so a failure loses nothing
    await putObject(dav, objectUrl(target, basename, '.ics'), updated)
    await deleteObject(dav, found.object.url, found.object.etag)
  }

  return { ...body, id }
})
