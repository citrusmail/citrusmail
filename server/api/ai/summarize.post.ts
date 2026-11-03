import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const schema = z.object({ folder: z.string().min(1).max(1000), id: messageIdParam })

// Always in the reader's language (Settings → Reading), whatever the email is written in
const system = (language: string) => `You summarize one email for its recipient, who is deciding what to do with it.
Write two to four short bullet points, each starting with "- ". Lead with what the sender wants or what happened, then any dates, amounts, deadlines or decisions. If the reader needs to act, the last bullet starts with "!" and says what to do. Plain text only, no headings, no preamble, no closing remark.
Write the summary in ${language}, even when the email is in another language. Keep names, product names and quoted titles as they are.`

export default defineEventHandler(async (event) => {
  const { folder, id } = await readValidatedBody(event, schema)
  return withAccount(event, async (account) => {
    const message = await mailFor(account).getMessage(folder, id, false)
    const settings = await readStore<Partial<UserSettings>>(account, 'settings', {})
    return streamResponse(await aiStream(account, { system: system(languageName(settings.language || 'en')), prompt: messageForPrompt(message), maxTokens: 2000, effort: 'low' }))
  })
})
