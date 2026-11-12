import { defineEventHandler, getQuery, getRouterParam } from 'nuxt/server'

// Idempotent: deleting an event that is already gone is not an error. An
// occurrence id removes just that occurrence from its series
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id', { decode: true })!
  const { calendarId } = getQuery<{ calendarId?: string }>(event)
  const dav = await useCalDav(await requireAccount(event))
  if (!dav) {
    throw notSetUp('caldav')
  }

  const { basename, occurrence } = parseEventId(id)
  const found = await locateEvent(dav, calendarId ? [findCollection(dav, calendarId)] : dav.collections, basename)
  if (!found) {
    return { id }
  }

  const remaining = occurrence ? excludeOccurrence(found.object.data, occurrence, viewerZone(event)) : null
  if (remaining) {
    await putObject(dav, found.object.url, remaining, found.object.etag, true)
  } else {
    await deleteObject(dav, found.object.url, found.object.etag)
  }

  return { id }
})
