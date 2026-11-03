import { defineEventHandler, readValidatedBody } from 'nuxt/server'
import { z } from 'zod'

// An address, or a whole domain as @example.com
const entry = z.string().trim().toLowerCase().max(254)
  .refine(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /^@[^\s@]+\.[^\s@]+$/.test(value), 'Use an address like ada@example.com or a domain like @example.com')

const schema = z.object({
  allowed: z.array(entry).max(1000),
  blocked: z.array(entry).max(1000),
  blockAction: z.enum(['junk', 'trash'])
})

// Saves both lists, then files the Inbox and Junk by them straight away
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, schema)
  const account = await requireAccount(event)
  const unique = (list: string[]) => [...new Set(list)]
  const blocked = unique(body.blocked)
  // A sender can't be on both lists: the newest choice wins, and blocking is the newer one here
  const lists: SenderLists = { allowed: unique(body.allowed).filter(item => !blocked.includes(item)), blocked, blockAction: body.blockAction }
  await writeStore(account, 'senders', lists)
  const moved = await applySenderLists(account).catch(() => 0)
  return { lists, moved }
})
