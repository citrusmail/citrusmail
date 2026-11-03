import { z } from 'zod'
import { toLocalISO } from './time'

// `local: true` also lets Z-suffixed strings (pre-floating deployments) and
// seconds-less ones through, so anything off the canonical 19-character
// `YYYY-MM-DDTHH:mm:ss` form is rewritten before it reaches the store and
// the two representations never mix
export const localDatetime = z.iso.datetime({ local: true })
  .transform(value => value.length === 19 ? value : toLocalISO(new Date(value)))

export const eventSchema = z.object({
  id: z.string().min(1).max(1000),
  calendarId: z.string().min(1, 'Calendar is required'),
  title: z.string().min(1, 'Title is required').max(100),
  // Generous: CalDAV descriptions carry whole meeting invites
  description: z.string().max(20000).optional(),
  start: localDatetime,
  end: localDatetime,
  allDay: z.boolean().optional(),
  recurring: z.boolean().optional()
}).refine(event => new Date(event.end) > new Date(event.start), {
  message: 'End must be after start',
  path: ['end']
})

export type EventSchema = z.output<typeof eventSchema>

export const contactSchema = z.object({
  id: z.string().max(1000).default(''),
  bookId: z.string().min(1, 'Address book is required'),
  name: z.string().trim().min(1, 'Name is required').max(200),
  emails: z.array(z.email()).default([]),
  phones: z.array(z.string().trim().min(1).max(50)).default([]),
  company: z.string().max(200).optional(),
  title: z.string().max(200).optional(),
  note: z.string().max(5000).optional(),
  birthday: z.string().max(20).optional()
})

export type ContactSchema = z.output<typeof contactSchema>
