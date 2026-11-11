import { createHash } from 'node:crypto'
import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

/**
 * Translates a message's text, piece by piece, so the reader can swap each
 * piece in place and keep the sender's links and formatting. The answer
 * streams as ⟦lang:xx⟧ then ⟦0⟧…⟦1⟧…, and is kept: the same text into the
 * same language is answered from storage the next time
 */
const schema = z.object({
  segments: z.array(z.string().max(5000)).min(1).max(800)
    .refine(list => list.reduce((sum, item) => sum + item.length, 0) <= 80_000, 'This message is too long to translate'),
  to: z.string().regex(/^[a-z]{2,3}$/)
})

function system(to: string) {
  const language = languageName(to)
  return `You translate an email into ${language}.
You get the email's text as numbered segments in reading order. Together they form the message; a segment may be only part of a sentence, split off by a link or formatting, with the rest in its neighbours.
First write ⟦lang:xx⟧ with the ISO 639-1 code of the email's original language. Then, for every segment in order, write ⟦n⟧ followed by its translation, and nothing else.
Keep each segment's share of the meaning inside that segment, so links and bold text stay on the right words. Keep names, email addresses, URLs, numbers and codes as they are. A segment already in ${language}, or with nothing to translate, is copied unchanged. Never skip, merge or add segments.`
}

async function* keep(parts: AsyncGenerator<string>, key: string) {
  let all = ''
  for await (const part of parts) {
    all += part
    yield part
  }
  if (all.includes('⟦lang:')) await useStorage('citrusmail').setItem(key, all)
}

export default defineEventHandler(async (event) => {
  const { segments, to } = await readValidatedBody(event, schema)
  const account = await requireAccount(event)
  const key = `translate:${createHash('sha256').update(`${to}\0${JSON.stringify(segments)}`).digest('hex').slice(0, 40)}`

  const cached = await useStorage('citrusmail').getItem<string>(key)
  if (cached) return new Response(cached, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Translation': 'cached' } })

  const prompt = segments.map((text, index) => `⟦${index}⟧${text}`).join('\n')
  const parts = await aiStream(account, { system: system(to), prompt, maxTokens: 32_000, effort: 'low' })
  return streamResponse(keep(parts, key))
})
