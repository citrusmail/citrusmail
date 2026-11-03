import Anthropic from '@anthropic-ai/sdk'
import { createError } from 'nuxt/server'

/**
 * Your own AI key, used for replies, summaries and search. Keys are sealed on
 * this server (vault.ts) and, through settings sync, travel in your mailbox
 * sealed with your mail password. Prompts go straight from this server to
 * the provider you chose; nothing else sees them
 */
interface ProviderInfo {
  label: string
  model: string
  /** OpenAI-compatible chat completions endpoint, for the providers that speak it */
  base?: string
  hint: string
}

export const PROVIDERS: Record<AiProvider, ProviderInfo> = {
  anthropic: { label: 'Anthropic (Claude)', model: 'claude-opus-5-5', hint: 'console.anthropic.com → API keys' },
  openai: { label: 'OpenAI', model: 'gpt-5', base: 'https://api.openai.com/v1', hint: 'platform.openai.com → API keys' },
  gemini: { label: 'Google Gemini', model: 'gemini-2.5-flash', hint: 'aistudio.google.com → Get API key' },
  grok: { label: 'xAI Grok', model: 'grok-4', base: 'https://api.x.ai/v1', hint: 'console.x.ai → API keys' },
  perplexity: { label: 'Perplexity', model: 'sonar-pro', base: 'https://api.perplexity.ai', hint: 'perplexity.ai → Settings → API' }
}

export const PROVIDER_ORDER = Object.keys(PROVIDERS) as AiProvider[]

/** What's saved for each provider: the key and, optionally, a model of your choice */
export type AiKeys = Partial<Record<AiProvider, { key: string, model?: string }>>

export async function readAiKeys(account: AccountSettings): Promise<AiKeys> {
  const stored = await readStore<{ sealed?: string } | null>(account, 'ai', null)
  if (!stored?.sealed) return {}
  try {
    return await unsealValue<AiKeys>(stored.sealed)
  } catch {
    return {}
  }
}

export async function writeAiKeys(account: AccountSettings, keys: AiKeys) {
  await writeStore(account, 'ai', { sealed: await sealValue(keys) })
}

export async function aiStatus(account: AccountSettings): Promise<AiStatus> {
  const keys = await readAiKeys(account)
  const settings = await readStore<Partial<UserSettings>>(account, 'settings', {})
  const saved = PROVIDER_ORDER.filter(provider => keys[provider]?.key)
  return {
    providers: PROVIDER_ORDER.map(provider => ({
      provider,
      label: PROVIDERS[provider].label,
      saved: Boolean(keys[provider]?.key),
      hint: PROVIDERS[provider].hint,
      model: keys[provider]?.model || PROVIDERS[provider].model
    })),
    active: settings.aiProvider && saved.includes(settings.aiProvider) ? settings.aiProvider : saved[0]
  }
}

export interface AiRequest {
  system: string
  prompt: string
  maxTokens?: number
  /** Claude only: how hard to think. Quick jobs run at low */
  effort?: 'low' | 'medium' | 'high'
}

function providerError(provider: AiProvider, status: number, detail = ''): Error {
  const label = PROVIDERS[provider].label
  if (status === 401 || status === 403) return createError({ status: 400, message: `${label} didn't accept your API key. Check it in Settings → AI.` })
  if (status === 429) return createError({ status: 429, message: `${label} says you've hit your rate limit or run out of credit.` })
  return createError({ status: 502, message: `${label} couldn't answer${detail ? `: ${detail.slice(0, 200)}` : '.'}` })
}

/** Server-sent events, one JSON payload per `data:` line */
async function* sse(response: Response): AsyncGenerator<unknown> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newline
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try {
        yield JSON.parse(data)
      } catch {
        // A keep-alive or partial line; the next one carries on
      }
    }
  }
}

async function* streamAnthropic(key: string, model: string, request: AiRequest): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey: key })
  try {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: request.maxTokens ?? 16000,
      system: request.system,
      messages: [{ role: 'user', content: request.prompt }],
      output_config: { effort: request.effort ?? 'medium' },
      // If the safety classifiers decline, the API reruns on the recommended model
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default'
    })
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') yield event.delta.text
    }
    const final = await stream.finalMessage()
    if (final.stop_reason === 'refusal') throw createError({ status: 422, message: 'Claude declined to write this one.' })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) throw providerError('anthropic', 401)
    if (error instanceof Anthropic.RateLimitError) throw providerError('anthropic', 429)
    if (error instanceof Anthropic.APIError) throw providerError('anthropic', error.status ?? 502, error.message)
    throw error
  }
}

async function* streamOpenAiCompatible(provider: AiProvider, key: string, model: string, request: AiRequest): AsyncGenerator<string> {
  const response = await fetch(`${PROVIDERS[provider].base}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [{ role: 'system', content: request.system }, { role: 'user', content: request.prompt }]
    }),
    signal: AbortSignal.timeout(120_000)
  })
  if (!response.ok) throw providerError(provider, response.status, await response.text().catch(() => ''))
  for await (const chunk of sse(response)) {
    const text = (chunk as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content
    if (text) yield text
  }
}

async function* streamGemini(key: string, model: string, request: AiRequest): AsyncGenerator<string> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: 'user', parts: [{ text: request.prompt }] }]
    }),
    signal: AbortSignal.timeout(120_000)
  })
  if (!response.ok) throw providerError('gemini', response.status, await response.text().catch(() => ''))
  for await (const chunk of sse(response)) {
    const parts = (chunk as { candidates?: { content?: { parts?: { text?: string }[] } }[] }).candidates?.[0]?.content?.parts ?? []
    for (const part of parts) if (part.text) yield part.text
  }
}

/** Streams the answer from the account's chosen provider */
export async function aiStream(account: AccountSettings, request: AiRequest): Promise<AsyncGenerator<string>> {
  const keys = await readAiKeys(account)
  const { active } = await aiStatus(account)
  const saved = active && keys[active]
  if (!active || !saved?.key) throw createError({ status: 400, message: 'Add an AI key in Settings → AI first.' })
  const model = saved.model || PROVIDERS[active].model
  if (active === 'anthropic') return streamAnthropic(saved.key, model, request)
  if (active === 'gemini') return streamGemini(saved.key, model, request)
  return streamOpenAiCompatible(active, saved.key, model, request)
}

export async function aiText(account: AccountSettings, request: AiRequest): Promise<string> {
  let text = ''
  for await (const part of await aiStream(account, request)) text += part
  return text.trim()
}

/** A streamed plain-text response. The first chunk is awaited, so a bad key is a proper error, not a cut-off stream */
export async function streamResponse(parts: AsyncGenerator<string>): Promise<Response> {
  const encoder = new TextEncoder()
  const first = await parts.next()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (!first.done && first.value) controller.enqueue(encoder.encode(first.value))
      if (first.done) controller.close()
    },
    async pull(controller) {
      try {
        const { done, value } = await parts.next()
        if (done) controller.close()
        else controller.enqueue(encoder.encode(value))
      } catch (error) {
        controller.enqueue(encoder.encode(`\n\n[${(error as Error).message}]`))
        controller.close()
      }
    },
    cancel() {
      parts.return(undefined)
    }
  })
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}

/** The message as the model reads it: headers and plain text, trimmed to a sensible length */
export function messageForPrompt(message: MessageDetail, limit = 24_000): string {
  const who = (a: Address) => a.name ? `${a.name} <${a.address}>` : a.address
  const body = (message.text || '').replace(/\n{3,}/g, '\n\n').trim()
  return [
    `From: ${who(message.from)}`,
    `To: ${message.to.map(who).join(', ')}`,
    message.cc.length ? `Cc: ${message.cc.map(who).join(', ')}` : '',
    `Date: ${message.date}`,
    `Subject: ${message.subject}`,
    '',
    body.length > limit ? `${body.slice(0, limit)}\n[…the rest is cut]` : body
  ].filter(line => line !== '').join('\n')
}
