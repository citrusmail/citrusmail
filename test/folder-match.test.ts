import { describe, expect, it } from 'vitest'
import { folderKey, matchFolder } from '../server/utils/folder-match'
import { jmapRuleFilter } from '../server/utils/jmap'

// The same mailbox seen over IMAP (paths are full names) and over JMAP (paths are ids)
const imap: Folder[] = [
  { path: 'INBOX', name: 'Inbox', role: 'inbox', unread: 0, depth: 0 },
  { path: 'INBOX.Orders', name: 'Orders', unread: 0, depth: 1 },
  { path: 'INBOX.Work.AWS', name: 'AWS', unread: 0, depth: 2 }
]
const jmap: Folder[] = [
  { path: 'INBOX', name: 'Inbox', role: 'inbox', unread: 0, depth: 0, fullName: 'INBOX' },
  { path: 'c3', name: 'Orders', unread: 0, depth: 0, fullName: 'Orders' },
  { path: 'c9', name: 'AWS', unread: 0, depth: 1, fullName: 'Work/AWS' }
]

describe('folders across IMAP and JMAP', () => {
  it('compares full names without case, delimiter or the INBOX. prefix', () => {
    expect(folderKey('INBOX.Work.AWS')).toBe('work/aws')
    expect(folderKey('Work/AWS')).toBe('work/aws')
    expect(folderKey('INBOX')).toBe('inbox')
  })

  it('keeps a path that is already this account’s', () => {
    expect(matchFolder(jmap, 'c3')?.path).toBe('c3')
    expect(matchFolder(imap, 'INBOX.Orders')?.path).toBe('INBOX.Orders')
  })

  it('finds an IMAP path over JMAP, and a JMAP id over IMAP by the name saved with it', () => {
    expect(matchFolder(jmap, 'INBOX.Work.AWS')?.path).toBe('c9')
    expect(matchFolder(imap, 'c9', 'Work/AWS')?.path).toBe('INBOX.Work.AWS')
  })

  it('finds nothing for a folder that isn’t there', () => {
    expect(matchFolder(imap, 'c4')).toBeUndefined()
    expect(matchFolder(jmap, 'INBOX.Gone')).toBeUndefined()
  })
})

describe('rule start marks over JMAP', () => {
  const rule = { match: 'all' as const, conditions: [{ field: 'from' as const, value: 'shop.test' }] }

  it('uses the time on a mark made over IMAP', () => {
    expect(jmapRuleFilter({ ...rule, after: { validity: '1234', uid: 50, at: Date.UTC(2026, 0, 2) } }))
      .toEqual({ operator: 'AND', conditions: [{ from: 'shop.test' }, { after: '2026-01-02T00:00:00.000Z' }] })
  })

  it('reads an older JMAP mark from its uid', () => {
    expect(jmapRuleFilter({ ...rule, after: { validity: 'jmap', uid: Date.UTC(2026, 0, 3) } }))
      .toEqual({ operator: 'AND', conditions: [{ from: 'shop.test' }, { after: '2026-01-03T00:00:00.000Z' }] })
  })
})
