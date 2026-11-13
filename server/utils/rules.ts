import type { FetchMessageObject, SearchObject } from 'imapflow'
import { accountKey, inBackground, withImap, withMailbox } from './imap'
import { moveOnce } from './move-once'

export function criteriaFor(rule: MailRule, validity: string): SearchObject[] | undefined {
  const parts: SearchObject[] = rule.conditions
    .filter(condition => condition.value.trim())
    .map(({ field, value }) => ({ [field]: value.trim() }))
  if (!parts.length) return undefined

  // "All": one search ANDs its keys, and a key fits in it once. Two conditions
  // on the same field are searches of their own; moveOnce takes what all find
  const searches: SearchObject[] = rule.match === 'any' && parts.length > 1 ? [{ or: parts }] : []
  if (!searches.length) {
    for (const part of parts) {
      const field = Object.keys(part)[0]!
      const free = searches.find(search => !(field in search))
      if (free) Object.assign(free, part)
      else searches.push({ ...part })
    }
  }
  const criteria = searches[0]!
  // A rule saved without "apply to existing" only sees mail that arrived after
  // it: by UID when the mark is this Inbox's, otherwise by the time it was made
  // (SEARCH SINCE is by day, so fileFrom drops what came earlier that day)
  if (rule.after && rule.after.validity === validity) criteria.uid = `${rule.after.uid}:*`
  else if (rule.after?.at) criteria.since = new Date(rule.after.at)
  return searches
}

/**
 * What a rule with a start mark may touch among what the search found. The
 * search alone finds too much: `UID n:*` always includes the newest message,
 * even one before n, and SINCE goes by day
 */
export function fromMark(rule: MailRule, validity: string) {
  const { after } = rule
  if (!after) return undefined
  if (after.validity === validity) return (msg: FetchMessageObject) => msg.uid >= after.uid
  const { at } = after
  return at === undefined ? undefined : (msg: FetchMessageObject) => new Date(msg.internalDate ?? 0).getTime() >= at
}

/**
 * Gives every start mark a time, once. Marks made before marks carried one
 * (or by a device on the other protocol) would otherwise read as "no start",
 * and the rule would sweep all the mail already in the Inbox
 */
async function stampRules(account: AccountSettings, rules: MailRule[]): Promise<MailRule[]> {
  if (!rules.some(rule => rule.after && rule.after.at === undefined)) return rules
  const now = Date.now()
  const stamped = rules.map(rule => rule.after && rule.after.at === undefined
    ? { ...rule, after: { ...rule.after, at: rule.after.validity === 'jmap' ? rule.after.uid : now } }
    : rule)
  await writeStore(account, 'rules', stamped)
  return stamped
}

/**
 * The enabled rules with their folders as this account names them. A rule
 * whose folder isn't here (deleted, or saved on a device using the other
 * protocol and not found by name) is left out: it never marks mail read
 * without being able to move it
 */
export async function localRules(account: AccountSettings): Promise<MailRule[]> {
  const saved = await readStore<MailRule[]>(account, 'rules', [])
  if (!saved.some(rule => rule.enabled && rule.folder)) return []
  const rules = await stampRules(account, saved)
  const folders = await mailFor(account).listFolders()
  return rules.filter(rule => rule.enabled && rule.folder).flatMap((rule) => {
    const folder = matchFolder(folders, rule.folder, rule.folderName)
    return folder && folder.role !== 'inbox' ? [{ ...rule, folder: folder.path }] : []
  })
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
  const { protocol } = account.incoming
  // POP3 has no folders to file into
  if (protocol === 'pop3') return 0
  const jmap = protocol === 'jmap'
  const mark = () => (jmap ? jmapInboxState(account) : inboxMarkOf(account)).catch(() => '')
  const key = accountKey(account)
  const before = await mark()
  if (!force && before && lastInbox.get(key) === before) return 0
  await collectReceipts(account).catch(() => 0)
  const screened = await applySenderLists(account).catch(() => 0)
  const moved = screened + (jmap ? await runJmapRules(account) : await runFolderRules(account))
  lastInbox.set(key, moved ? await mark() : before)
  return moved
}

async function runJmapRules(account: AccountSettings): Promise<number> {
  const rules = await localRules(account)
  return rules.length ? jmapRunRules(account, rules) : 0
}

/** Folders other rules file into that contain this rule's folder ("AWS" for "AWS/Failures") */
function parentsOf(rule: MailRule, rules: MailRule[]) {
  return [...new Set(rules
    .map(other => other.folder)
    .filter(folder => folder !== rule.folder && /^[/.]/.test(rule.folder.slice(folder.length)) && rule.folder.startsWith(folder)))]
}

/** Each message is filed once: a server that leaves the original behind doesn't get it copied again every check */
function fileFrom(account: AccountSettings, source: string, rule: MailRule, criteria: SearchObject[], keep?: (msg: FetchMessageObject) => boolean) {
  return moveOnce(account, { from: source, to: rule.folder, criteria, keep, markRead: rule.markRead })
}

async function runFolderRules(account: AccountSettings): Promise<number> {
  const all = await localRules(account)
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
    if (criteria) moved += await fileFrom(account, 'INBOX', rule, criteria, fromMark(rule, validity))
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
  if (account.incoming.protocol === 'jmap') return jmapRuleMark()
  return withMailbox(account, 'INBOX', async client => ({
    validity: String(client.mailbox ? client.mailbox.uidValidity : ''),
    uid: client.mailbox ? Number(client.mailbox.uidNext) : 1,
    at: Date.now()
  }))
}
