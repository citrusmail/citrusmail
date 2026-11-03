import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const schema = z.object({
  folder: z.string().min(1).max(1000),
  id: messageIdParam,
  /** What the reply should say, in the reader's own words; empty lets the model decide */
  instruction: z.string().trim().max(2000).optional(),
  /** The reply so far, when asking for a change to it */
  draft: z.string().max(40_000).optional(),
  /** The change, e.g. "Make it shorter" */
  tweak: z.string().trim().max(500).optional()
})

function system(account: AccountSettings) {
  const me = account.name ? `${account.name} <${account.email}>` : account.email
  return `You write email replies on behalf of ${me}. Write only the body of the reply: no subject line, no quoted original, no signature (one is added automatically), and no notes to the writer.
Match the sender's language and level of formality. Be direct and warm, and keep it as short as the situation allows. Open with a greeting that uses the sender's first name when it's known.
Separate paragraphs with a blank line. Use plain text, no Markdown.
Never invent facts, dates, prices, promises or attachments the writer didn't give you. Where the reply needs something only the writer knows, write it in [square brackets] for them to fill in.`
}

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, schema)
  return withAccount(event, async (account) => {
    const message = await mailFor(account).getMessage(body.folder, body.id, false)
    const parts = [`The email being replied to:\n\n${messageForPrompt(message)}`]
    if (body.draft && body.tweak) {
      parts.push(`The reply so far:\n\n${body.draft}`, `Rewrite the reply with this change: ${body.tweak}\nKeep everything else that still fits.`)
    } else {
      parts.push(body.instruction ? `What the reply should say: ${body.instruction}` : 'Write the reply the writer most likely wants to send.')
    }
    return streamResponse(await aiStream(account, { system: system(account), prompt: parts.join('\n\n---\n\n'), maxTokens: 4000, effort: 'medium' }))
  })
})
