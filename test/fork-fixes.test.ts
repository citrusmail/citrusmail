import { describe, expect, it } from 'vitest'
import type { FetchMessageObject } from 'imapflow'
import { collectionOf } from '../server/utils/dav'
import { criteriaFor, fromMark } from '../server/utils/rules'
import { htmlToText } from '../server/utils/sanitize'

const rule = (over: Partial<MailRule>): MailRule => ({
  id: 'r', enabled: true, match: 'all', folder: 'Work', markRead: false,
  conditions: [{ field: 'from', value: 'alice' }, { field: 'from', value: 'example.com' }],
  ...over
} as MailRule)
const msg = (uid: number, at = 0) => ({ uid, internalDate: new Date(at) }) as unknown as FetchMessageObject

describe('rules', () => {
  it('keeps both conditions on one field as searches of their own', () => {
    expect(criteriaFor(rule({}), '1')).toEqual([{ from: 'alice' }, { from: 'example.com' }])
  })

  it('keeps an "any" rule as one OR search', () => {
    expect(criteriaFor(rule({ match: 'any' }), '1')).toEqual([{ or: [{ from: 'alice' }, { from: 'example.com' }] }])
  })

  it('never takes mail older than its start mark, which UID n:* still finds', () => {
    const keep = fromMark(rule({ after: { validity: '1', uid: 50, at: 0 } }), '1')!
    expect(keep(msg(49))).toBe(false)
    expect(keep(msg(50))).toBe(true)
  })

  it('goes by arrival time when the mark is from another Inbox', () => {
    const keep = fromMark(rule({ after: { validity: 'other', uid: 50, at: 1000 } }), '1')!
    expect(keep(msg(1, 999))).toBe(false)
    expect(keep(msg(1, 1000))).toBe(true)
  })
})

describe('DAV object urls', () => {
  const session = { collections: [{ url: 'https://dav.example.com/cards/book/' }] } as never

  it('finds the collection an object is in', () => {
    expect(collectionOf(session, 'https://dav.example.com/cards/book/abc.vcf')).toBeTruthy()
  })

  it.each(['', '.', '..', '%2e%2e', 'a/b.vcf', 'a?b'])('refuses %j, which is not an object inside it', (name) => {
    expect(() => collectionOf(session, `https://dav.example.com/cards/book/${name}`)).toThrow()
  })
})

describe('a message preview', () => {
  it('survives a character reference past the last code point', () => {
    expect(htmlToText('<p>a&#99999999;b &#65;</p>')).toBe('ab A')
  })
})
