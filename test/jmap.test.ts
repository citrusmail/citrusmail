import { describe, expect, it } from 'vitest'
import {
  JMAP_CORE, JMAP_ID, JMAP_MAIL, JMAP_SUBMISSION, JmapError, fillJmapTemplate, jmapAuthHeader, jmapDownload,
  jmapFlagPatch, jmapFolderOf, jmapHasAttachments, jmapFolders, jmapListFilter, jmapMailboxTree, jmapMovePatch, jmapQueryCalls,
  jmapRequest, jmapSearchFilter, jmapSession, jmapSessionUrl, jmapSetResult, jmapSummary, jmapUpload,
  JMAP_RULE_MARK, isJmapReport, jmapEnvelope, jmapFromFilter, jmapRuleFilter,
  jmapSignIn, parseJmapSession, pickJmapIdentity, readJmapPage, readJmapResponses
} from '../server/utils/jmap'
import { jmapIncoming, jmapServerText } from '../shared/utils/jmap-server'
import type { JmapContext, JmapMailbox } from '../server/utils/jmap'

/* ------------------------------------------------------------------ */
/* A mocked JMAP server                                                */
/* ------------------------------------------------------------------ */

interface Seen { url: string, init?: RequestInit }

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

const SESSION = {
  capabilities: { [JMAP_CORE]: {}, [JMAP_MAIL]: {}, [JMAP_SUBMISSION]: {} },
  accounts: { A1: { accountCapabilities: { [JMAP_MAIL]: {}, [JMAP_SUBMISSION]: {} } } },
  primaryAccounts: { [JMAP_MAIL]: 'A1' },
  apiUrl: '/jmap/api/',
  downloadUrl: 'https://files.example.com/download/{accountId}/{blobId}/{name}?type={type}',
  uploadUrl: '/jmap/upload/{accountId}/',
  state: 's1'
}

let accounts = 0

/** A fresh account each time, so the session cache never carries between tests */
function account(incoming: Partial<AccountSettings['incoming']> = {}): AccountSettings {
  accounts++
  return {
    email: 'ada@example.com',
    password: `secret-${accounts}`,
    incoming: { protocol: 'jmap', host: 'mail.example.com', port: 443, security: 'tls', ...incoming },
    outgoing: { host: 'mail.example.com', port: 587, security: 'starttls' }
  }
}

function server(handler: (url: URL, init?: RequestInit) => Response | undefined) {
  const seen: Seen[] = []
  const fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    seen.push({ url: url.toString(), init })
    if (url.pathname === '/.well-known/jmap') return new Response(null, { status: 307, headers: { Location: '/jmap/session' } })
    if (url.pathname === '/jmap/session') return json(SESSION)
    return handler(url, init) ?? new Response('not found', { status: 404 })
  }) as typeof globalThis.fetch
  return { seen, fetch }
}

const body = (seen: Seen) => JSON.parse(String(seen.init?.body))

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

describe('session', () => {
  it('builds the well-known URL from the host, or uses the one given', () => {
    expect(jmapSessionUrl({ protocol: 'jmap', host: 'mail.example.com', port: 443, security: 'tls' })).toBe('https://mail.example.com/.well-known/jmap')
    expect(jmapSessionUrl({ protocol: 'jmap', host: 'mail.example.com', port: 8443, security: 'tls' })).toBe('https://mail.example.com:8443/.well-known/jmap')
    expect(jmapSessionUrl({ protocol: 'jmap', host: 'localhost', port: 8080, security: 'none' })).toBe('http://localhost:8080/.well-known/jmap')
    expect(jmapSessionUrl({ protocol: 'jmap', host: '::1', port: 443, security: 'tls' })).toBe('https://[::1]/.well-known/jmap')
    expect(jmapSessionUrl({ protocol: 'jmap', host: 'x', port: 443, security: 'tls', url: 'https://api.fastmail.com/jmap/session' })).toBe('https://api.fastmail.com/jmap/session')
  })

  it('signs in with Basic (username, else the address) or a bearer token', () => {
    const basic = account()
    expect(jmapAuthHeader(basic)).toBe(`Basic ${Buffer.from(`ada@example.com:${basic.password}`).toString('base64')}`)
    expect(jmapAuthHeader({ ...basic, username: 'ada' })).toBe(`Basic ${Buffer.from(`ada:${basic.password}`).toString('base64')}`)
    expect(jmapAuthHeader({ ...basic, incoming: { ...basic.incoming, auth: 'bearer' } })).toBe(`Bearer ${basic.password}`)
  })

  it('follows the well-known redirect on the same host and resolves relative URLs', async () => {
    const { seen, fetch } = server(() => undefined)
    const ctx: JmapContext = { account: account(), fetch }
    const session = await jmapSession(ctx)
    expect(session).toEqual({
      apiUrl: 'https://mail.example.com/jmap/api/',
      downloadUrl: SESSION.downloadUrl,
      uploadUrl: 'https://mail.example.com/jmap/upload/{accountId}/',
      accountId: 'A1',
      submission: true,
      state: 's1'
    })
    expect(seen.map(s => s.url)).toEqual(['https://mail.example.com/.well-known/jmap', 'https://mail.example.com/jmap/session'])
    expect(new Headers(seen[1]!.init?.headers).get('authorization')).toMatch(/^Basic /)
    // Cached: no second fetch
    await jmapSession(ctx)
    expect(seen).toHaveLength(2)
  })

  it('never sends the password along a redirect to another host', async () => {
    const fetch = (async () => new Response(null, { status: 302, headers: { Location: 'https://elsewhere.example.net/jmap' } })) as unknown as typeof globalThis.fetch
    await expect(jmapSession({ account: account(), fetch })).rejects.toThrow(/another host/)
  })

  it('reports a rejected password as an authentication failure', async () => {
    const fetch = (async () => new Response('', { status: 401, headers: { 'WWW-Authenticate': 'Basic' } })) as unknown as typeof globalThis.fetch
    const error = await jmapSession({ account: account(), fetch }).catch(e => e)
    expect(error).toBeInstanceOf(JmapError)
    expect(error.authenticationFailed).toBe(true)
  })

  it('needs the mail capability, has submission only with the account capability, and refuses http URLs from an https session', () => {
    expect(() => parseJmapSession({ ...SESSION, capabilities: { [JMAP_CORE]: {} } }, 'https://x.example.com/s')).toThrow(/doesn't offer mail/)
    const noSubmit = parseJmapSession({ ...SESSION, accounts: { A1: { accountCapabilities: { [JMAP_MAIL]: {} } } } }, 'https://x.example.com/s')
    expect(noSubmit.submission).toBe(false)
    expect(() => parseJmapSession({ ...SESSION, apiUrl: 'http://x.example.com/api' }, 'https://x.example.com/s')).toThrow(/insecure/)
  })
})

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

describe('requests', () => {
  it('posts the method calls with the capabilities the server has', async () => {
    const { seen, fetch } = server(url => url.pathname === '/jmap/api/'
      ? json({ methodResponses: [['Mailbox/get', { list: [] }, '0']], sessionState: 's1' })
      : undefined)
    const responses = await jmapRequest({ account: account(), fetch }, [['Mailbox/get', { accountId: 'A1' }, '0']])
    expect(responses.get('0')).toEqual({ list: [] })
    const api = seen.at(-1)!
    expect(api.url).toBe('https://mail.example.com/jmap/api/')
    expect(api.init?.method).toBe('POST')
    expect(body(api)).toEqual({
      using: [JMAP_CORE, JMAP_MAIL, JMAP_SUBMISSION],
      methodCalls: [['Mailbox/get', { accountId: 'A1' }, '0']]
    })
  })

  it('throws a method error with its JMAP type', () => {
    expect(() => readJmapResponses({ methodResponses: [['error', { type: 'anchorNotFound' }, 'q']] })).toThrow(JmapError)
    const error = (() => {
      try {
        readJmapResponses({ methodResponses: [['error', { type: 'anchorNotFound' }, 'q']] })
      } catch (e) {
        return e as JmapError
      }
    })()
    expect(error?.type).toBe('anchorNotFound')
    expect(() => readJmapResponses({ nope: true })).toThrow(/JMAP server/)
  })

  it('reads /set results and turns SetErrors into errors', () => {
    const response = { created: { new: { id: 'M9' } }, notUpdated: { M1: { type: 'notFound' } }, notDestroyed: {} }
    expect(jmapSetResult(response, 'created', 'new')).toEqual({ id: 'M9' })
    expect(() => jmapSetResult(response, 'updated', 'M1')).toThrow('notFound')
    expect(jmapSetResult(response, 'destroyed', 'M2')).toEqual({})
  })

  it('fills upload and download templates, escaping each value', async () => {
    expect(fillJmapTemplate('/d/{accountId}/{blobId}/{name}?t={type}', { accountId: 'A1', blobId: 'B 1', name: 'a/b.eml', type: 'message/rfc822' }))
      .toBe('/d/A1/B%201/a%2Fb.eml?t=message%2Frfc822')
    const { seen, fetch } = server((url) => {
      if (url.pathname === '/jmap/upload/A1/') return json({ blobId: 'G1', type: 'message/rfc822', size: 3 })
      if (url.hostname === 'files.example.com') return new Response('raw message')
    })
    const ctx = { account: account(), fetch }
    expect(await jmapUpload(ctx, Buffer.from('abc'))).toBe('G1')
    expect(new Headers(seen.at(-1)!.init?.headers).get('content-type')).toBe('message/rfc822')
    expect((await jmapDownload(ctx, 'G1')).toString()).toBe('raw message')
    expect(seen.at(-1)!.url).toBe('https://files.example.com/download/A1/G1/message.eml?type=message%2Frfc822')
  })
})

/* ------------------------------------------------------------------ */
/* Mailboxes                                                           */
/* ------------------------------------------------------------------ */

const MAILBOXES: JmapMailbox[] = [
  { id: 'trash', name: 'Deleted', role: 'trash' },
  { id: 'p', name: 'Projects', sortOrder: 10, unreadEmails: 2 },
  { id: 'in', name: 'INBOX', role: 'inbox', unreadEmails: 5 },
  { id: 'c', name: 'Citrus', parentId: 'p' },
  { id: 'd', name: 'Drafts', role: 'drafts' },
  { id: 'a', name: 'Aardvark', sortOrder: 10 },
  { id: 'cc', name: 'Deep', parentId: 'c' },
  { id: 'imp', name: 'Important', role: 'important' }
]

describe('mailboxes', () => {
  it('turns mailboxes into folders: roles first, then the tree in order', () => {
    expect(jmapFolders(MAILBOXES)).toEqual([
      { path: 'INBOX', name: 'Inbox', role: 'inbox', unread: 5, depth: 0, fullName: 'INBOX' },
      { path: 'd', name: 'Drafts', role: 'drafts', unread: 0, depth: 0, fullName: 'Drafts' },
      { path: 'trash', name: 'Deleted', role: 'trash', unread: 0, depth: 0, fullName: 'Deleted' },
      { path: 'imp', name: 'Important', role: undefined, unread: 0, depth: 0, fullName: 'Important' },
      { path: 'a', name: 'Aardvark', role: undefined, unread: 0, depth: 0, fullName: 'Aardvark' },
      { path: 'p', name: 'Projects', role: undefined, unread: 2, depth: 0, fullName: 'Projects' },
      { path: 'c', name: 'Citrus', role: undefined, unread: 0, depth: 1, fullName: 'Projects/Citrus' },
      { path: 'cc', name: 'Deep', role: undefined, unread: 0, depth: 2, fullName: 'Projects/Citrus/Deep' }
    ])
  })

  it('lists a folder and everything in it, deepest first', () => {
    expect(jmapMailboxTree(MAILBOXES, 'p').map(m => m.id)).toEqual(['cc', 'c', 'p'])
  })

  it('shows a search hit in the Inbox when it is there, otherwise its first folder', () => {
    expect(jmapFolderOf({ id: 'M1', mailboxIds: { p: true, in: true } }, MAILBOXES)).toBe('INBOX')
    expect(jmapFolderOf({ id: 'M1', mailboxIds: { c: true } }, MAILBOXES)).toBe('c')
  })
})

/* ------------------------------------------------------------------ */
/* Emails                                                              */
/* ------------------------------------------------------------------ */

describe('emails', () => {
  it('maps an Email to a message summary', () => {
    expect(jmapSummary({
      id: 'M1',
      keywords: { $flagged: true },
      from: [{ name: 'Ada', email: 'ada@example.com' }],
      to: [{ name: null, email: 'bob@example.com' }],
      subject: 'Hi',
      receivedAt: '2026-11-01T10:00:00Z',
      preview: '  Hello\n  there ',
      hasAttachment: true,
      messageId: ['abc@example.com']
    }, 'INBOX')).toEqual({
      id: 'M1',
      folder: 'INBOX',
      subject: 'Hi',
      from: { name: 'Ada', address: 'ada@example.com' },
      to: [{ name: undefined, address: 'bob@example.com' }],
      date: '2026-11-01T10:00:00.000Z',
      preview: 'Hello there',
      unread: true,
      flagged: true,
      hasAttachments: true,
      messageId: '<abc@example.com>'
    })
    const bare = jmapSummary({ id: 'M2', keywords: { $seen: true } }, 'p')
    expect(bare).toMatchObject({ subject: '', from: { address: '' }, unread: false, flagged: false, date: new Date(0).toISOString(), messageId: undefined })
  })

  it('shows the paperclip from the parts, not the server\'s hasAttachment', () => {
    // Stalwart 0.11 says hasAttachment: true with no attachments at all
    expect(jmapHasAttachments({ id: 'M1', hasAttachment: true, attachments: [] })).toBe(false)
    expect(jmapHasAttachments({ id: 'M1', hasAttachment: false, attachments: [{ disposition: 'attachment', name: null }] })).toBe(true)
    expect(jmapHasAttachments({ id: 'M1', attachments: [{ disposition: null, name: 'invoice.pdf' }] })).toBe(true)
    // An image placed in the HTML is no attachment
    expect(jmapHasAttachments({ id: 'M1', hasAttachment: true, attachments: [{ disposition: 'inline', name: 'logo.png' }] })).toBe(false)
    // A server that gives no parts: its own word
    expect(jmapHasAttachments({ id: 'M1', hasAttachment: true })).toBe(true)
  })

  it('builds the list filter from the ListQuery', () => {
    expect(jmapListFilter('in', {})).toEqual({ inMailbox: 'in' })
    const now = Date.parse('2026-11-11T00:00:00Z')
    expect(jmapListFilter('in', { q: 'invoice', unread: true, flagged: true, from: 'ada', within: 'week', on: '2026-11-02', attachments: true }, now)).toEqual({
      operator: 'AND',
      conditions: [
        { inMailbox: 'in' },
        { notKeyword: '$seen' },
        { hasKeyword: '$flagged' },
        { from: 'ada' },
        { after: '2026-11-04T00:00:00.000Z' },
        { after: '2026-11-02T00:00:00.000Z', before: '2026-11-03T00:00:00.000Z' },
        { hasAttachment: true },
        { text: 'invoice' }
      ]
    })
  })

  it('translates AI search criteria', () => {
    expect(jmapSearchFilter({ from: 'ada', seen: false, header: { 'content-type': 'multipart/mixed' }, or: [{ text: 'invoice' }, { text: 'receipt' }] })).toEqual({
      operator: 'AND',
      conditions: [
        { from: 'ada' },
        { notKeyword: '$seen' },
        { hasAttachment: true },
        { operator: 'OR', conditions: [{ text: 'invoice' }, { text: 'receipt' }] }
      ]
    })
    expect(jmapSearchFilter({ since: new Date('2026-01-01T00:00:00Z') })).toEqual({ after: '2026-01-01T00:00:00.000Z' })
    expect(jmapSearchFilter({})).toEqual({})
  })

  it('queries a page and gets its emails in one request, after the cursor', () => {
    const [query, get] = jmapQueryCalls('A1', { inMailbox: 'in' }, { anchor: 'M50', limit: 50 })
    expect(query).toEqual(['Email/query', {
      accountId: 'A1',
      filter: { inMailbox: 'in' },
      sort: [{ property: 'receivedAt', isAscending: false }],
      anchor: 'M50',
      anchorOffset: 1,
      limit: 50,
      calculateTotal: true
    }, 'q'])
    expect(get![1]['#ids']).toEqual({ resultOf: 'q', name: 'Email/query', path: '/ids' })
    expect(get![1].properties).toContain('attachments')
    expect(get![1].bodyProperties).toEqual(['partId', 'disposition', 'name'])
    expect(jmapQueryCalls('A1', {}, { limit: 50 })[0]![1]).not.toHaveProperty('anchor')
  })

  it('reads a page in query order, with a cursor only when more follow', () => {
    const responses = new Map<string, Record<string, unknown>>([
      ['q', { ids: ['M2', 'M1'], position: 0, total: 3 }],
      ['g', { list: [{ id: 'M1', subject: 'one' }, { id: 'M2', subject: 'two' }], notFound: [] }]
    ])
    const page = readJmapPage(responses, 'INBOX')
    expect(page.messages.map(m => m.subject)).toEqual(['two', 'one'])
    expect(page).toMatchObject({ total: 3, cursor: 'M1' })
    responses.set('q', { ids: ['M2', 'M1'], position: 1, total: 3 })
    expect(readJmapPage(responses, 'INBOX').cursor).toBeUndefined()
  })

  it('patches only the flags asked for, and moves between mailboxes', () => {
    expect(jmapFlagPatch({ unread: false })).toEqual({ 'keywords/$seen': true })
    expect(jmapFlagPatch({ unread: true, flagged: false })).toEqual({ 'keywords/$seen': null, 'keywords/$flagged': null })
    expect(jmapFlagPatch({})).toEqual({})
    expect(jmapMovePatch('in', 'trash')).toEqual({ 'mailboxIds/in': null, 'mailboxIds/trash': true })
  })

  it('sends as the identity for the address, a domain wildcard, or the first', () => {
    const identities = [{ id: 'I1', email: 'other@example.com' }, { id: 'I2', email: '*@example.com' }, { id: 'I3', email: 'Ada@Example.com' }]
    expect(pickJmapIdentity(identities, 'ada@example.com')).toBe('I3')
    expect(pickJmapIdentity(identities.slice(0, 2), 'ada@example.com')).toBe('I2')
    expect(pickJmapIdentity(identities.slice(0, 1), 'ada@example.com')).toBe('I1')
    expect(pickJmapIdentity([], 'ada@example.com')).toBeUndefined()
  })

  it('accepts JMAP ids and nothing that could reach a URL or patch path', () => {
    expect(JMAP_ID.test('Mf8a1b2c3d4e5_-')).toBe(true)
    for (const bad of ['', 'a/b', 'a b', '1:*', '../x', 'x'.repeat(256)]) expect(JMAP_ID.test(bad)).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/* Sign-in: one server field, password or token                        */
/* ------------------------------------------------------------------ */

describe('sign-in', () => {
  it('reads the one server field: a host, a URL with a port, or a session URL', () => {
    expect(jmapIncoming('mail.example.com')).toEqual({ protocol: 'jmap', host: 'mail.example.com', port: 443, security: 'tls' })
    expect(jmapIncoming(' http://127.0.0.1:18090/ ')).toEqual({ protocol: 'jmap', host: '127.0.0.1', port: 18090, security: 'none' })
    expect(jmapIncoming('https://api.fastmail.com/jmap/session')).toEqual({ protocol: 'jmap', host: 'api.fastmail.com', port: 443, security: 'tls', url: 'https://api.fastmail.com/jmap/session' })
    expect(jmapIncoming('[::1]:8443')).toEqual({ protocol: 'jmap', host: '::1', port: 8443, security: 'tls' })
    for (const bad of ['', '   ', 'ftp://example.com', 'http://']) expect(jmapIncoming(bad)).toBeUndefined()
  })

  it('shows saved settings back as short as they can be', () => {
    for (const text of ['mail.example.com', 'http://127.0.0.1:18090', 'mail.example.com:8443', 'https://api.fastmail.com/jmap/session', '[::1]:8443']) {
      expect(jmapServerText(jmapIncoming(text)!)).toBe(text)
    }
  })

  /** A server that takes `secret` as Basic or as Bearer, whichever `accepts` says */
  function signInServer(accepts: 'basic' | 'bearer' | 'none') {
    const tried: string[] = []
    const fetch = (async (input: string | URL, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get('authorization') ?? ''
      const kind = auth.startsWith('Bearer ') ? 'bearer' : 'basic'
      if (new URL(String(input)).pathname === '/.well-known/jmap') tried.push(kind)
      if (kind !== accepts) return new Response('', { status: 401 })
      if (new URL(String(input)).pathname === '/.well-known/jmap') return json(SESSION)
      return json({ methodResponses: [['Core/echo', {}, '0']], sessionState: 's1' })
    }) as typeof globalThis.fetch
    return { tried, fetch }
  }

  it('tries the secret as a password, then as an API token', async () => {
    const basic = signInServer('basic')
    expect((await jmapSignIn(account(), basic.fetch)).auth).toBe('basic')
    expect(basic.tried).toEqual(['basic'])

    const bearer = signInServer('bearer')
    expect((await jmapSignIn(account(), bearer.fetch)).auth).toBe('bearer')
    expect(bearer.tried).toEqual(['basic', 'bearer'])

    const neither = signInServer('none')
    const error = await jmapSignIn(account(), neither.fetch).catch(e => e)
    expect(error.authenticationFailed).toBe(true)
    expect(neither.tried).toEqual(['basic', 'bearer'])
  })

  it('keeps a known way, and never sends a non-ASCII password as a token', async () => {
    const known = signInServer('bearer')
    await jmapSignIn(account({ auth: 'bearer' }), known.fetch)
    expect(known.tried).toEqual(['bearer'])

    const unicode = signInServer('none')
    await jmapSignIn({ ...account(), password: 'pässwörd' }, unicode.fetch).catch(() => {})
    expect(unicode.tried).toEqual(['basic'])
  })
})

/* ------------------------------------------------------------------ */
/* Rules, sender lists, reports and settings                           */
/* ------------------------------------------------------------------ */

describe('settings features', () => {
  it('hides the settings folder from the folder list', () => {
    expect(jmapFolders([{ id: 'in', name: 'Inbox', role: 'inbox' }, { id: 's', name: 'CitrusMail Settings' }, { id: 'k', name: 'CitrusMail Settings', parentId: 'in' }]).map(f => f.path))
      .toEqual(['INBOX', 'k'])
  })

  it('turns a rule into a filter: all, any, and only mail since it was saved', () => {
    const conditions = [{ field: 'from' as const, value: ' aws ' }, { field: 'subject' as const, value: 'Failed' }, { field: 'to' as const, value: ' ' }]
    expect(jmapRuleFilter({ conditions, match: 'all' })).toEqual({ operator: 'AND', conditions: [{ from: 'aws' }, { subject: 'Failed' }] })
    expect(jmapRuleFilter({ conditions, match: 'any' })).toEqual({ operator: 'OR', conditions: [{ from: 'aws' }, { subject: 'Failed' }] })
    expect(jmapRuleFilter({ conditions: conditions.slice(0, 1), match: 'any', after: { validity: JMAP_RULE_MARK, uid: Date.parse('2026-11-11T00:00:00Z') } }))
      .toEqual({ operator: 'AND', conditions: [{ from: 'aws' }, { after: '2026-11-11T00:00:00.000Z' }] })
    // An IMAP mark means nothing here, as a stale UIDVALIDITY means nothing on IMAP
    expect(jmapRuleFilter({ conditions: conditions.slice(0, 1), match: 'all', after: { validity: '12345', uid: 7 } })).toEqual({ from: 'aws' })
    expect(jmapRuleFilter({ conditions: [{ field: 'from', value: '  ' }], match: 'all' })).toBeUndefined()
  })

  it('finds mail from any of the listed senders', () => {
    expect(jmapFromFilter([])).toBeUndefined()
    expect(jmapFromFilter(['spam@example.com'])).toEqual({ from: 'spam@example.com' })
    expect(jmapFromFilter(['a@x.com', '@y.com'])).toEqual({ operator: 'OR', conditions: [{ from: 'a@x.com' }, { from: '@y.com' }] })
  })

  it('finds read receipts and delivery reports by their Content-Type', () => {
    expect(isJmapReport({ 'id': 'a', 'header:Content-Type': ' multipart/report; report-type=disposition-notification; boundary="b"' } as never)).toBe(true)
    expect(isJmapReport({ 'id': 'b', 'header:Content-Type': ' multipart/report;\r\n report-type=delivery-status' } as never)).toBe(true)
    expect(isJmapReport({ 'id': 'c', 'header:Content-Type': ' text/plain' } as never)).toBe(false)
    expect(isJmapReport({ id: 'd' })).toBe(false)
  })

  it('asks for delivery reports on tracked mail, with the envelope id as xtext', () => {
    expect(jmapEnvelope('me@x.com', ['a@y.com'])).toEqual({ mailFrom: { email: 'me@x.com' }, rcptTo: [{ email: 'a@y.com' }] })
    expect(jmapEnvelope('me@x.com', ['a@y.com', 'b@y.com'], { id: '<a+b=c@x.com>' })).toEqual({
      mailFrom: { email: 'me@x.com', parameters: { RET: 'HDRS', ENVID: '<a+2Bb+3Dc@x.com>' } },
      rcptTo: [{ email: 'a@y.com', parameters: { NOTIFY: 'SUCCESS,FAILURE' } }, { email: 'b@y.com', parameters: { NOTIFY: 'SUCCESS,FAILURE' } }]
    })
  })
})
