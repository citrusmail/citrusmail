import { describe, expect, it } from 'vitest'
import { looksLikeStylesheet, previewToSnippet, serverPreview } from '../server/utils/preview-text'
import { htmlToText } from '../server/utils/sanitize'
import { jmapHtmlOnly } from '../server/utils/jmap'

describe('previewToSnippet', () => {
  it('folds whitespace into one line', () => {
    expect(previewToSnippet('Hi Bob,\r\n\r\n  see   the file')).toBe('Hi Bob, see the file')
  })

  it('drops link addresses in angle brackets, also one the server cut off', () => {
    expect(previewToSnippet('Sign in<https://c.example/AbC_d-e?x=1> now')).toBe('Sign in now')
    expect(previewToSnippet('Your order<https://c.example/very-long-trac')).toBe('Your order')
  })

  it('decodes the common entities', () => {
    expect(previewToSnippet('Tom &amp; Ann said &quot;ok&quot;&nbsp;&#39;yes&#39;')).toBe('Tom & Ann said "ok" \'yes\'')
  })

  it('leaves plain text with angle brackets and bare links alone', () => {
    expect(previewToSnippet('if a < b then c > d')).toBe('if a < b then c > d')
    expect(previewToSnippet('Details: https://example.org/issue/1')).toBe('Details: https://example.org/issue/1')
  })

  it('caps the length', () => {
    expect(previewToSnippet('x'.repeat(500))).toHaveLength(200)
    expect(previewToSnippet('x'.repeat(500), 140)).toHaveLength(140)
  })
})

describe('looksLikeStylesheet', () => {
  it('spots a stylesheet', () => {
    expect(looksLikeStylesheet('@import url(https://fonts.example/css?family=Lato); @media only screen')).toBe(true)
    expect(looksLikeStylesheet('body { margin: 0; padding: 0 } .x { color: red }')).toBe(true)
    expect(looksLikeStylesheet('.ExternalClass{width:100%}')).toBe(true)
  })

  it('leaves ordinary sentences alone', () => {
    expect(looksLikeStylesheet('Hi Bob, the meeting is at 10:30; see you there.')).toBe(false)
    expect(looksLikeStylesheet('Totals {draft}: 3 items; reply by Friday')).toBe(false)
  })
})

describe('serverPreview', () => {
  it('shows nothing for a stylesheet, a missing preview or an empty one', () => {
    expect(serverPreview('@media screen { a { color: red } }')).toBe('')
    expect(serverPreview(undefined)).toBe('')
    expect(serverPreview(null)).toBe('')
    expect(serverPreview('')).toBe('')
  })

  it('cleans the rest', () => {
    expect(serverPreview('Google  \nAds<https://c.example/AbC> Your ID')).toBe('Google Ads Your ID')
  })
})

describe('HTML previews', () => {
  it('keeps a heading, a paragraph and table cells apart', () => {
    const html = '<style>body{margin:0}</style><h2>Thanks for your order</h2><p>Your <b>invoice</b> is 4411.</p><table><tr><td>Total</td><td>$20</td></tr></table><div>Track it</div>'
    expect(previewToSnippet(htmlToText(html))).toBe('Thanks for your order Your invoice is 4411. Total $20 Track it')
  })

  it('tells an HTML-only message from one with a plain text part', () => {
    expect(jmapHtmlOnly({ id: 'a', textBody: [{ partId: '1', type: 'text/html' }] })).toBe(true)
    expect(jmapHtmlOnly({ id: 'b', textBody: [{ partId: '1', type: 'text/plain' }] })).toBe(false)
    expect(jmapHtmlOnly({ id: 'c' })).toBe(false)
  })
})
