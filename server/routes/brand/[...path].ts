import { createError, defineEventHandler } from 'nuxt/server'

// /brand/logo.svg → <brand folder>/logo.svg (see server/utils/brand-files.ts)
export default defineEventHandler(async (event) => {
  if (!['GET', 'HEAD'].includes(event.req.method)) throw createError({ status: 405, message: 'Method not allowed' })
  let path: string
  try {
    path = decodeURIComponent(event.url.pathname.replace(/^\/brand\//, ''))
  } catch {
    // A stray % is no file's name
    throw createError({ status: 404, message: 'Not found' })
  }
  const file = await brandFile(path)
  if (!file) throw createError({ status: 404, message: 'Not found' })
  return file
})
