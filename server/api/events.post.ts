import { defineEventHandler, readValidatedBody, setResponseStatus } from 'nuxt/server'

export default defineEventHandler(async (event): Promise<CalendarEvent> => {
  const body = await readValidatedBody(event, eventSchema)
  const dav = await useCalDav(await requireAccount(event))
  if (!dav) {
    throw notSetUp('caldav')
  }

  const calendar = findCollection(dav, body.calendarId)
  const zone = viewerZone(event)
  const existing = await findEventObject(dav, calendar, body.id)

  // A replayed create (the first one landed but its response did not) edits
  // what is there instead of failing on it
  if (existing) {
    await putObject(dav, existing.url, patchCalendar(existing.data, body.id, body, zone), existing.etag, true)
  } else {
    await putObject(dav, objectUrl(calendar, body.id, '.ics'), eventToCalendar(body, zone))
  }

  setResponseStatus(event, 201)

  return body
})
