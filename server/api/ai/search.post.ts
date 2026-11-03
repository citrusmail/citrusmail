import type { SearchObject } from 'imapflow'
import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

const schema = z.object({ q: z.string().trim().min(2).max(500) })

// What the model hands back: IMAP search terms, all optional
const criteriaSchema = z.object({
  from: z.string().max(200).nullish(),
  to: z.string().max(200).nullish(),
  subject: z.string().max(200).nullish(),
  text: z.array(z.string().max(100)).max(6).nullish(),
  since: z.iso.date().nullish(),
  before: z.iso.date().nullish(),
  unread: z.boolean().nullish(),
  flagged: z.boolean().nullish(),
  attachments: z.boolean().nullish(),
  interpreted: z.string().max(300).nullish()
})

function plannerPrompt(today: string) {
  return `You turn a person's question about their own mailbox into IMAP search terms. Today is ${today}.
Answer with one JSON object and nothing else, using only these optional keys:
"from" (a name, address or domain fragment), "to", "subject" (one short phrase), "text" (up to 6 words or short phrases that would appear in the message; any of them may match), "since" and "before" (YYYY-MM-DD), "unread", "flagged", "attachments" (booleans), and "interpreted" (a short plain-English line describing the search, e.g. "From Ada, since March, about invoices").
Prefer few, distinctive terms: a search with too many terms finds nothing. Include likely synonyms in "text" (e.g. invoice, receipt, bill). Leave out anything the question doesn't imply.`
}

function toCriteria(plan: z.infer<typeof criteriaSchema>): SearchObject {
  const criteria: SearchObject = {}
  if (plan.from) criteria.from = plan.from
  if (plan.to) criteria.to = plan.to
  if (plan.subject) criteria.subject = plan.subject
  if (plan.since) criteria.since = new Date(`${plan.since}T00:00:00Z`)
  if (plan.before) criteria.before = new Date(`${plan.before}T00:00:00Z`)
  if (plan.unread) criteria.seen = false
  if (plan.flagged) criteria.flagged = true
  if (plan.attachments) criteria.header = { 'content-type': 'multipart/mixed' }
  const words = (plan.text ?? []).filter(Boolean)
  if (words.length === 1) criteria.text = words[0]
  else if (words.length > 1) criteria.or = words.map(word => ({ text: word }))
  if (!Object.keys(criteria).length) criteria.all = true
  return criteria
}

function parsePlan(raw: string) {
  const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
  try {
    return criteriaSchema.parse(JSON.parse(json))
  } catch {
    return undefined
  }
}

// Asks the model what to look for, searches every folder for it, then has the
// model answer the question from what turned up
export default defineEventHandler(async (event) => {
  const { q } = await readValidatedBody(event, schema)
  return withAccount(event, async (account): Promise<AiSearchResult> => {
    const today = new Date().toISOString().slice(0, 10)
    const plan = parsePlan(await aiText(account, { system: plannerPrompt(today), prompt: q, maxTokens: 1500, effort: 'low' }))
      ?? { text: q.split(/\s+/).filter(word => word.length > 3).slice(0, 4) }
    const mail = mailFor(account)
    let messages = await mail.searchAll(toCriteria(plan), 30)
    // Several words that must all match is the usual reason for nothing; one at a time is the fallback
    if (!messages.length && plan.text && plan.text.length && (plan.from || plan.subject || plan.since)) {
      messages = await mail.searchAll(toCriteria({ ...plan, text: undefined }), 30)
    }

    let answer = messages.length ? '' : 'Nothing in your mail matches that.'
    if (messages.length) {
      const list = messages.slice(0, 20).map((m, i) => `${i + 1}. ${m.date.slice(0, 10)} — from ${m.from.name || m.from.address} — “${m.subject}” — ${m.preview}`).join('\n')
      answer = await aiText(account, {
        system: 'You answer a question about the reader\'s mailbox from the search results given, in one or two plain sentences. Name the most relevant message by sender and date. If the results don\'t answer it, say what they do contain. No lists, no Markdown.',
        prompt: `Question: ${q}\n\nSearch results (newest first):\n${list}`,
        maxTokens: 1200,
        effort: 'low'
      }).catch(() => '')
    }
    return { answer, messages, interpreted: plan.interpreted || q }
  })
})
