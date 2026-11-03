import { createError, defineEventHandler } from 'nuxt/server'

// Loaded after every other stylesheet. brand/custom.css when there is one,
// read on each request so it can change without a rebuild
export default defineEventHandler(async (event) => {
  if (!['GET', 'HEAD'].includes(event.req.method)) throw createError({ status: 405, message: 'Method not allowed' })
  return await brandFile('custom.css') ?? new Response('', {
    headers: { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
  })
})
