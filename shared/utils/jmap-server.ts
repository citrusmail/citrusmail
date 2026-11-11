import type { IncomingSettings } from '../types/index'

/**
 * A JMAP server is one thing to type: a host (mail.example.com), a host with
 * a scheme or port (http://127.0.0.1:8080), or a full session URL
 * (https://api.fastmail.com/jmap/session). These turn that one field into
 * incoming settings and back. A bare host means /.well-known/jmap on it.
 */
export function jmapIncoming(input: string): IncomingSettings | undefined {
  const text = input.trim()
  if (!text) return undefined
  let url: URL
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return undefined
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return undefined
  const secure = url.protocol === 'https:'
  const incoming: IncomingSettings = {
    protocol: 'jmap',
    host: url.hostname.replace(/^\[|\]$/g, ''),
    port: Number(url.port) || (secure ? 443 : 80),
    security: secure ? 'tls' : 'none'
  }
  // Anything past the host is where the session is
  if ((url.pathname !== '/' && url.pathname !== '') || url.search) incoming.url = url.toString()
  return incoming
}

/** What the server field shows for saved settings: as short as it can be */
export function jmapServerText(incoming: IncomingSettings): string {
  if (incoming.url) return incoming.url
  if (!incoming.host) return ''
  const secure = incoming.security !== 'none'
  const host = incoming.host.includes(':') ? `[${incoming.host}]` : incoming.host
  const port = incoming.port && incoming.port !== (secure ? 443 : 80) ? `:${incoming.port}` : ''
  return `${secure ? '' : 'http://'}${host}${port}`
}
