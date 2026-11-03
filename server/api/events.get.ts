import { defineEventHandler, getValidatedQuery } from 'nuxt/server'
import { z } from 'zod'
import { millisecondsInDay } from 'date-fns/constants'

// The widest client fetch is the month view's twelve-week window (the grid
// plus the fallback rows below it), so with a bit of slack anything larger
// is a misuse of the endpoint
const MAX_RANGE = 90 * millisecondsInDay

const querySchema = z.object({
  start: localDatetime,
  end: localDatetime
}).refine(query => new Date(query.end).getTime() - new Date(query.start).getTime() <= MAX_RANGE, 'Range too large')

export default defineEventHandler(async (event): Promise<CalendarEvent[]> => {
  const query = await getValidatedQuery(event, querySchema)
  const dav = await useCalDav(await requireAccount(event))
  if (!dav) {
    return []
  }

  const zone = viewerZone(event)
  // A day of slack each side: floating and all-day events are matched by the
  // server in its own zone, the exact cut happens below
  const timeRange = {
    start: new Date(localToEpoch(query.start, zone) - millisecondsInDay).toISOString(),
    end: new Date(localToEpoch(query.end, zone) + millisecondsInDay).toISOString()
  }

  const results = await Promise.allSettled(dav.collections.map(async (calendar) => {
    const calendarId = encodeId(calendar.url)
    const objects = await dav.client.fetchCalendarObjects({
      calendar,
      timeRange,
      urlFilter: url => !url.endsWith('/')
    })

    return objects.flatMap((object) => {
      if (typeof object.data !== 'string' || !object.data) {
        return []
      }
      try {
        return objectToEvents(object.data, basenameOf(object.url), calendarId, query, zone)
      } catch {
        // One malformed object should not hide the rest of the calendar
        return []
      }
    })
  }))

  const failed = results.find(result => result.status === 'rejected')
  if (failed && results.every(result => result.status === 'rejected')) {
    throw davError(failed.reason, dav.host, 'caldav')
  }

  return results.flatMap(result => result.status === 'fulfilled' ? result.value : [])
})
