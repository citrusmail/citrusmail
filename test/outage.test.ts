import { describe, expect, it } from 'vitest'
import { isOutage, withDeadline } from '../server/utils/outage'

describe('isOutage', () => {
  it('counts a server that does not answer', () => {
    expect(isOutage(Object.assign(new Error('x'), { code: 'ECONNREFUSED' }))).toBe(true)
    expect(isOutage(Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }))).toBe(true)
    expect(isOutage(Object.assign(new Error('x'), { name: 'TimeoutError' }))).toBe(true)
    expect(isOutage(Object.assign(new Error('HTTP 502'), { responseCode: 502 }))).toBe(true)
  })

  it('never counts a refused password or a client error', () => {
    expect(isOutage(Object.assign(new Error('Authentication failed'), { authenticationFailed: true, code: 'ECONNRESET' }))).toBe(false)
    expect(isOutage(Object.assign(new Error('HTTP 404'), { responseCode: 404 }))).toBe(false)
    expect(isOutage(new Error('something else'))).toBe(false)
    expect(isOutage(undefined)).toBe(false)
  })
})

describe('withDeadline', () => {
  it('passes a prompt answer through', async () => {
    await expect(withDeadline(Promise.resolve(7), 50)).resolves.toBe(7)
  })

  it('times out as an outage', async () => {
    const error = await withDeadline(new Promise(() => {}), 10).catch((e: unknown) => e)
    expect(isOutage(error)).toBe(true)
  })
})
