import { createError, defineEventHandler, getRouterParam, getValidatedQuery } from 'nuxt/server'
import { z } from 'zod'

const INLINE = /^(image\/(png|jpe?g|gif|webp|avif|bmp)|application\/pdf|text\/plain)$/i

export default defineEventHandler(async (event) => {
  const id = messageIdParam.parse(getRouterParam(event, 'id', { decode: true }))
  const index = z.coerce.number().int().min(0).parse(getRouterParam(event, 'index'))
  const { folder } = await getValidatedQuery(event, folderQuery)

  const attachment = await withAccount(event, account => mailFor(account).getAttachment(folder, id, index))
  if (!attachment) throw createError({ status: 404, message: 'Attachment not found.' })

  const filename = attachment.filename || `attachment-${index + 1}`
  const disposition = INLINE.test(attachment.contentType) ? 'inline' : 'attachment'
  const ascii = filename.replace(/[^\x20-\x7E]|["\\]/g, '_')
  return new Response(new Uint8Array(attachment.content), {
    headers: {
      'Content-Type': attachment.contentType || 'application/octet-stream',
      'Content-Disposition': `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': String(attachment.content.length),
      // Attachments are untrusted: never let one run as a page on our origin
      'Content-Security-Policy': 'sandbox; default-src \'none\'; img-src \'self\' data:; style-src \'unsafe-inline\'',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600'
    }
  })
})
