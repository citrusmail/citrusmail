import type { SearchObject } from 'imapflow'
import { accountKey, inBackground, withImap, withMailbox } from './imap'

function criteriaFor(rule: MailRule, validity: string): SearchObject | undefined {
  const parts: SearchObject[] = rule.conditions
    .filter(condition => condition.value.trim())
    .map(({ field, value }) => ({ [field]: value.trim() }))
  if (!parts.length) return undefined

  const criteria: SearchObject = rule.match === 'any' && parts.length > 1
    ? { or: parts }
    : Object.assign({}, ...parts)
  // A rule saved without "apply to existing" only sees mail that arrived after it
  if (rule.after && rule.after.validity === validity) criteria.uid = `${rule.after.uid}:*`
  return criteria
}

/**
 * Files Inbox mail into folders by the account's rules, using the server's own
 * SEARCH so nothing is downloaded. Runs whenever CitrusMail checks for mail
 */
// The Inbox as rules last left it. Every search costs a round trip, so with
// nothing new since then the rules don't run at all
const lastInbox = new Map<string, string>()

async function inboxMarkOf(account: AccountSettings) {
  const status = await withImap(account, client => client.status('INBOX', { uidNext: true, messages: true }))
  return status ? `${status.uidNext}:${status.messages}` : ''
}

/** `force` runs them even when the Inbox hasn't changed, for rules just saved */
export function runRules(account: AccountSettings, force = false): Promise<number> {
  return inBackground(() => runRulesNow(account, force))
}

async function runRulesNow(account: AccountSettings, force: boolean): Promise<number> {
  if (account.incoming.protocol !== 'imap') return 0
  const key = accountKey(account)
  const before = await inboxMarkOf(account).catch(() => '')
  if (!force && before && lastInbox.get(key) === before) return 0
  await collectReceipts(account).catch(() => 0)
  const screened = await applySenderLists(account).catch(() => 0)
  const moved = screened + await runFolderRules(account)
  lastInbox.set(key, moved ? await inboxMarkOf(account).catch(() => '') : before)
  return moved
}

/** Folders other rules file into that contain this rule's folder ("AWS" for "AWS/Failures") */
function parentsOf(rule: MailRule, rules: MailRule[]) {
  return [...new Set(rules
    .map(other => other.folder)
    .filter(folder => folder !== rule.folder && /^[/.]/.test(rule.folder.slice(folder.length)) && rule.folder.startsWith(folder)))]
}

async function fileFrom(account: AccountSettings, source: string, rule: MailRule, criteria: SearchObject) {
  return withMailbox(account, source, async (client) => {
    const uids = await client.search(criteria, { uid: true }).catch(() => false)
    if (!Array.isArray(uids) || !uids.length) return 0
    const range = uids.join(',')
    if (rule.markRead) await client.messageFlagsAdd(range, ['\\Seen'], { uid: true })
    return await client.messageMove(range, rule.folder, { uid: true }).catch(() => false) ? uids.length : 0
  })
}

async function runFolderRules(account: AccountSettings): Promise<number> {
  const all = (await readStore<MailRule[]>(account, 'rules', [])).filter(rule => rule.enabled && rule.folder)
  if (!all.length) return 0
  // The most specific folder wins: with "AWS" and "AWS/Failures" both
  // matching, the message goes to Failures, whatever order the rules are in
  const rules = all
    .map((rule, index) => ({ rule, index, depth: parentsOf(rule, all).length }))
    .sort((a, b) => b.depth - a.depth || a.index - b.index)
    .map(entry => entry.rule)

  const validity = await withMailbox(account, 'INBOX', async client => String(client.mailbox ? client.mailbox.uidValidity : ''))
  let moved = 0
  for (const rule of rules) {
    const criteria = criteriaFor(rule, validity)
    if (criteria) moved += await fileFrom(account, 'INBOX', rule, criteria)
  }
  // A rule that applies to existing mail also sorts what its parent folder's
  // rule already filed there, so adding "AWS/Successes" after "AWS" still works
  for (const rule of rules.filter(rule => !rule.after)) {
    const criteria = criteriaFor(rule, validity)
    if (!criteria) continue
    for (const parent of parentsOf(rule, all)) moved += await fileFrom(account, parent, rule, criteria).catch(() => 0)
  }
  return moved
}

/** Where a new rule starts when it shouldn't touch mail already in the Inbox */
export async function inboxMark(account: AccountSettings): Promise<MailRule['after']> {
  return withMailbox(account, 'INBOX', async client => ({
    validity: String(client.mailbox ? client.mailbox.uidValidity : ''),
    uid: client.mailbox ? Number(client.mailbox.uidNext) : 1
  }))
}
