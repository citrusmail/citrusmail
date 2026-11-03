import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const schema = z.object({ origin: z.url().max(200) })

// Settings → Tracking: loads this server's own image through the address
// given, from the outside, the way a recipient's mail app would. Only an
// https address that reaches this CitrusMail passes
export default defineEventHandler(async (event): Promise<{ ok: boolean, origin?: string, message: string }> => {
  await requireAccount(event)
  const url = new URL((await readValidatedBody(event, schema)).origin)
  if (url.protocol !== 'https:') return { ok: false, message: 'The address needs to start with https://, or mail apps won’t load the image.' }

  try {
    const res = await guardedFetch(false, 10_000)(new URL('/r/check.gif', url.origin), { headers: { 'user-agent': 'CitrusMail address check' } })
    await res.body?.cancel()
    if (res.ok && res.headers.get('x-citrusmail-image') === '1') {
      return { ok: true, origin: url.origin, message: 'Recipients’ mail apps can reach this address.' }
    }
    return { ok: false, message: `${url.host} answered, but not as this CitrusMail (status ${res.status}). Check that it points here.` }
  } catch (error) {
    // A name that resolves to a private address fails inside fetch, as its cause
    const blocked = error instanceof BlockedHostError || (error as { cause?: unknown }).cause instanceof BlockedHostError
    if (blocked) return { ok: false, message: `${url.host} is on a private network, so recipients’ mail apps can’t reach it.` }
    return { ok: false, message: `${url.host} couldn’t be reached from the internet. Check the address and that it’s served over https.` }
  }
})
