/** Codes that mean the server could not be reached at all */
const UNREACHABLE = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT', 'ETIMEOUT', 'ESOCKET', 'ECONNECTION',
  'CONNECT_TIMEOUT', 'GREETING_TIMEOUT', 'NoConnection', 'EConnectionClosed', 'ClosedAfterConnectText'
])
const NOT_FOUND = new Set(['ENOTFOUND', 'EAI_AGAIN', 'EDNS'])
const TOO_BIG = new Set(['ETOOBIG', 'EMESSAGETOOBIG'])

interface MailErrorLike {
  code?: string
  message?: string
  authenticationFailed?: boolean
  tlsFailed?: boolean
  responseText?: string
  response?: unknown
  responseCode?: number
}

/**
 * A plain-language explanation of a connection, login or protocol error.
 * The server's own reply is only passed through once signed in (`trusted`):
 * before that, echoing whatever answered on a host and port would let anyone
 * use this server to read banners off other machines.
 */
export function describeMailError(error: unknown, server: ServerSettings, trusted = true): { message: string, auth: boolean } {
  const err = (error ?? {}) as MailErrorLike
  const code = err.code ?? ''
  const where = `${server.host} on port ${server.port}`

  if (code === 'EBLOCKEDHOST') {
    return { message: `${server.host} is on a private network, which this server doesn't connect to.`, auth: false }
  }
  if (TOO_BIG.has(code)) {
    return { message: 'This message is too large to open here.', auth: false }
  }

  if (err.authenticationFailed || code === 'EAUTH' || code === 'ENOAUTH' || err.responseCode === 535) {
    if (/\.office365\.com$|\.outlook\.com$/i.test(server.host)) {
      return { message: 'Microsoft no longer accepts passwords from mail apps. Sign in with Microsoft instead.', auth: true }
    }
    const provider = appPasswordProvider(server.host)
    const hint = provider ? ` ${provider.name} needs an app password: create one at ${provider.url}` : ' Check the email address and password.'
    return { message: `The password was rejected by ${server.host}.${hint}`, auth: true }
  }
  if (NOT_FOUND.has(code)) {
    return { message: `Couldn't find the server ${server.host}. Check the server name.`, auth: false }
  }
  if (err.tlsFailed || code === 'ETLS' || code === 'ClosedAfterConnectTLS' || /SSL|TLS|certificate|wrong version/i.test(`${code} ${err.message}`)) {
    return { message: `Couldn't open a secure connection to ${where}. Try the other security option (SSL/TLS or STARTTLS).`, auth: false }
  }
  if (UNREACHABLE.has(code)) {
    return { message: `Couldn't reach ${where}.`, auth: false }
  }
  if (!trusted) {
    return { message: `${server.host} on port ${server.port} didn't answer like a mail server. Check the server and port.`, auth: false }
  }
  const reply = (err.responseText || (typeof err.response === 'string' ? err.response : '') || err.message || '').trim().slice(0, 200)
  return { message: reply ? `${server.host} said: ${reply}` : `Something went wrong talking to ${server.host}.`, auth: false }
}
