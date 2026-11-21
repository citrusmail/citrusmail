// What counts as a mail server not answering, as opposed to refusing. No
// imports, so the tests can load it as it is

/** Codes that mean the server didn't answer (not a refusal) */
const OUTAGE_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET', 'EPIPE'
])

/** The server didn't answer, or answered with a server error: not a wrong password */
export function isOutage(error: unknown): boolean {
  const err = error as { code?: string, cause?: { code?: string }, responseCode?: number, authenticationFailed?: boolean, name?: string } | undefined
  if (!err || err.authenticationFailed) return false
  if ((err.code && OUTAGE_CODES.has(err.code)) || (err.cause?.code && OUTAGE_CODES.has(err.cause.code))) return true
  if (err.name === 'TimeoutError' || err.name === 'AbortError') return true
  return typeof err.responseCode === 'number' && err.responseCode >= 500
}

/** `promise`, or an ETIMEDOUT error once `ms` have passed */
export async function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error('The mail server took too long to answer'), { code: 'ETIMEDOUT' })), ms)
  })
  try {
    return await Promise.race([promise, late])
  } finally {
    clearTimeout(timer)
  }
}
