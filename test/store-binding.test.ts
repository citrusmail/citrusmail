import { describe, expect, it } from 'vitest'
import { jmapBoundIncoming } from '../server/utils/jmap'
import { storeId } from '../server/utils/store'

const account = (incoming: AccountSettings['incoming']): AccountSettings =>
  ({ email: 'victim@example.com', password: 'x', incoming, outgoing: { host: 'smtp.example.com', port: 587, security: 'starttls' } })

const victim = account({ protocol: 'imap', host: 'imap.example.com', port: 993, security: 'tls' })

// A JMAP session URL is the only server contacted, so it's what stored data is filed under
describe('stored data follows the server signed in to', () => {
  const forged = { protocol: 'jmap' as const, host: 'imap.example.com', port: 993, security: 'tls' as const, url: 'https://attacker.example/jmap/session' }

  it('takes a JMAP account\'s host, port and security from its session URL', () => {
    expect(jmapBoundIncoming(forged)).toMatchObject({ host: 'attacker.example', port: 443, security: 'tls', url: forged.url })
    expect(jmapBoundIncoming({ protocol: 'jmap', host: 'x', port: 1, security: 'tls', url: 'http://[::1]:8080/s' }))
      .toMatchObject({ host: '::1', port: 8080, security: 'none' })
  })

  it('leaves IMAP and JMAP without a URL alone', () => {
    expect(jmapBoundIncoming(victim.incoming)).toEqual(victim.incoming)
    const plain = { protocol: 'jmap' as const, host: 'jmap.example.com', port: 443, security: 'tls' as const }
    expect(jmapBoundIncoming(plain)).toEqual(plain)
  })

  it('never gives a JMAP session naming another host that host\'s data', () => {
    expect(storeId(account(forged))).not.toBe(storeId(victim))
    expect(storeId(account(forged))).toBe(storeId(account({ ...forged, host: 'attacker.example' })))
  })

  it('keeps existing accounts\' data where it was', () => {
    expect(storeId(victim)).toBe(storeId(account({ ...victim.incoming })))
    const jmap = { protocol: 'jmap' as const, host: 'api.fastmail.com', port: 443, security: 'tls' as const, url: 'https://api.fastmail.com/jmap/session' }
    expect(storeId(account(jmap))).toBe(storeId(account({ protocol: 'imap', host: 'api.fastmail.com', port: 993, security: 'tls' })))
  })
})
