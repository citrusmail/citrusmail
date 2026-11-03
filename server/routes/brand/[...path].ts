import { createError, defineEventHandler } from 'nuxt/server'

// /brand/logo.svg → <brand folder>/logo.svg (see server/utils/brand-files.ts)
export default defineEventHandler(async (event) => {
  if (!['GET', 'HEAD'].includes(event.req.method)) throw createError({ status: 405, message: 'Method not allowed' })
  const path = decodeURIComponent(event.url.pathname.replace(/^\/brand\//, ''))
  const file = await brandFile(path)
  if (!file) throw createError({ status: 404, message: 'Not found' })
  return file
})
