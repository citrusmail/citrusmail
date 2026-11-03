import { z } from 'zod'

const MAX_ATTACHMENTS = 25 * 1024 * 1024

const address = z.object({
  name: z.string().max(200).optional(),
  address: z.email()
})

/** A message from the composer: what /api/send, drafts and the outbox take */
export const outgoingSchema = z.object({
  to: z.array(address).max(100),
  cc: z.array(address).max(100).optional(),
  bcc: z.array(address).max(100).optional(),
  subject: z.string().max(998),
  html: z.string().max(5 * 1024 * 1024),
  text: z.string().max(5 * 1024 * 1024).optional(),
  inReplyTo: z.string().max(998).optional(),
  references: z.array(z.string().max(998)).max(100).optional(),
  attachments: z.array(z.object({
    filename: z.string().min(1).max(255),
    contentType: z.string().max(255),
    content: z.base64()
  })).max(50).optional(),
  readReceipt: z.boolean().optional()
})

export const sendableSchema = outgoingSchema
  .refine(m => m.to.length + (m.cc?.length ?? 0) + (m.bcc?.length ?? 0) > 0, { message: 'Add at least one recipient', path: ['to'] })
  .refine(m => (m.attachments ?? []).reduce((sum, a) => sum + a.content.length, 0) <= MAX_ATTACHMENTS, {
    message: 'Attachments can be 25 MB at most', path: ['attachments']
  })
