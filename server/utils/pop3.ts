import net from 'node:net'
import tls from 'node:tls'

const CRLF = Buffer.from('\r\n')
const END = Buffer.from('\r\n.\r\n')
/** Bigger than any message a mail server accepts; past this the server is misbehaving */
const MAX_BUFFER = 64 * 1024 * 1024

interface Pending {
  multiline: boolean
  resolve: (value: { line: string, body?: Buffer }) => void
  reject: (error: Error) => void
}

export class Pop3Error extends Error {
  code?: string
  authenticationFailed?: boolean
  responseText?: string
}

/** A minimal POP3 client (RFC 1939 + STLS from RFC 2595), one command at a time */
export class Pop3Client {
  private socket!: net.Socket
  // A growable buffer: appending doubles the capacity instead of copying the
  // whole message on every chunk, and multi-line scans resume where they stopped
  private store = Buffer.alloc(0)
  private length = 0
  private scanned = 0

  private get buffer(): Buffer {
    return this.store.subarray(0, this.length)
  }

  /** Only ever set to a tail of the current buffer: what is left after a reply */
  private set buffer(rest: Buffer) {
    rest.copy(this.store, 0)
    this.length = rest.length
    this.scanned = 0
  }

  private append(chunk: Buffer) {
    if (this.length + chunk.length > this.store.length) {
      const grown = Buffer.alloc(Math.max(this.store.length * 2, this.length + chunk.length, 64 * 1024))
      this.store.copy(grown, 0, 0, this.length)
      this.store = grown
    }
    chunk.copy(this.store, this.length)
    this.length += chunk.length
  }

  private pending?: Pending
  private queue: Promise<unknown> = Promise.resolve()

  static async connect(server: ServerSettings, user: string, pass: string, timeout = 10_000): Promise<Pop3Client> {
    const client = new Pop3Client()
    const target = await connectTarget(server.host)
    const options = { host: target.address, port: server.port, timeout }
    const tlsOptions = { servername: target.servername, rejectUnauthorized: !isLoopback(server.host) }
    client.attach(server.security === 'tls' ? tls.connect({ ...options, ...tlsOptions }) : net.connect(options))
    await client.read(false)

    if (server.security === 'starttls') {
      await client.command('STLS')
      const plain = client.socket
      plain.removeAllListeners('data')
      client.attach(tls.connect({ socket: plain, ...tlsOptions }))
      await new Promise<void>((resolve, reject) => {
        client.socket.once('secureConnect', () => resolve())
        client.socket.once('error', reject)
      })
    }

    try {
      await client.command(`USER ${user}`)
      await client.command(`PASS ${pass}`)
    } catch (error) {
      client.close()
      const failure = new Pop3Error('Authentication failed')
      failure.code = 'EAUTH'
      failure.authenticationFailed = true
      failure.responseText = (error as Pop3Error).responseText
      throw failure
    }
    return client
  }

  private attach(socket: net.Socket) {
    this.socket = socket
    this.length = 0
    this.scanned = 0
    socket.on('data', (chunk: Buffer) => {
      if (this.length + chunk.length > MAX_BUFFER) {
        this.fail(Object.assign(new Pop3Error('The server sent more data than any message can hold'), { code: 'ETOOBIG' }))
        socket.destroy()
        return
      }
      this.append(chunk)
      this.drain()
    })
    socket.on('timeout', () => this.fail(Object.assign(new Pop3Error('Connection timed out'), { code: 'ETIMEDOUT' })))
    socket.on('error', (error: Error) => this.fail(error))
    socket.on('close', () => this.fail(Object.assign(new Pop3Error('Connection closed'), { code: 'ECONNECTION' })))
  }

  private fail(error: Error) {
    const pending = this.pending
    this.pending = undefined
    pending?.reject(error)
  }

  private drain() {
    const pending = this.pending
    if (!pending) return
    const eol = this.buffer.indexOf(CRLF)
    if (eol < 0) return
    const line = this.buffer.subarray(0, eol).toString('utf8')

    if (!line.startsWith('+OK')) {
      this.buffer = this.buffer.subarray(eol + 2)
      this.pending = undefined
      const error = new Pop3Error(line.replace(/^-ERR\s*/, '') || 'Command failed')
      error.responseText = error.message
      return pending.reject(error)
    }
    if (!pending.multiline) {
      this.buffer = this.buffer.subarray(eol + 2)
      this.pending = undefined
      return pending.resolve({ line })
    }

    // Multi-line: the body runs until a line holding a single dot
    const start = eol + 2
    const isEmpty = this.buffer.subarray(start, start + 3).equals(Buffer.from('.\r\n'))
    const end = isEmpty ? start : this.buffer.indexOf(END, Math.max(start - 2, this.scanned - END.length))
    if (end < 0) {
      this.scanned = this.length
      return
    }
    // A copy: the buffer's memory is reused for what follows
    const raw = isEmpty ? Buffer.alloc(0) : Buffer.from(this.buffer.subarray(start, end + 2))
    this.buffer = this.buffer.subarray(isEmpty ? start + 3 : end + END.length)
    this.pending = undefined
    pending.resolve({ line, body: unstuff(raw) })
  }

  private read(multiline: boolean) {
    return new Promise<{ line: string, body?: Buffer }>((resolve, reject) => {
      this.pending = { multiline, resolve, reject }
      this.drain()
    })
  }

  command(cmd: string, multiline = false): Promise<{ line: string, body?: Buffer }> {
    const run = this.queue.then(() => {
      if (this.socket.destroyed) throw Object.assign(new Pop3Error('Connection closed'), { code: 'ECONNECTION' })
      this.socket.write(`${cmd}\r\n`)
      return this.read(multiline)
    })
    this.queue = run.catch(() => {})
    return run
  }

  async stat() {
    const { line } = await this.command('STAT')
    const [, count, size] = line.split(' ')
    return { count: Number(count), size: Number(size) }
  }

  /** Message numbers and their unique ids, oldest first */
  async uidl(): Promise<{ n: number, uid: string }[]> {
    const { body } = await this.command('UIDL', true)
    return body!.toString('latin1').split('\r\n').filter(Boolean).map((row) => {
      const [n, uid] = row.split(' ')
      return { n: Number(n), uid: uid! }
    })
  }

  async top(n: number, lines = 0) {
    return (await this.command(`TOP ${n} ${lines}`, true)).body!
  }

  async retr(n: number) {
    return (await this.command(`RETR ${n}`, true)).body!
  }

  async dele(n: number) {
    await this.command(`DELE ${n}`)
  }

  async quit() {
    await this.command('QUIT').catch(() => {})
    this.close()
  }

  close() {
    this.socket.destroy()
  }
}

/** Lines starting with ".." had their leading dot doubled by the server */
function unstuff(raw: Buffer): Buffer {
  const text = raw.toString('latin1')
  if (!text.includes('\r\n..') && !text.startsWith('..')) return raw
  return Buffer.from(text.replace(/^\.\./, '.').replaceAll('\r\n..', '\r\n.'), 'latin1')
}

/** Opens a session, runs `fn` and sends QUIT, which is when DELE takes effect */
export async function withPop3<T>(account: AccountSettings, fn: (client: Pop3Client) => Promise<T>): Promise<T> {
  const client = await Pop3Client.connect(account.incoming, account.username || account.email, account.password)
  try {
    const result = await fn(client)
    await client.quit()
    return result
  } catch (error) {
    client.close()
    throw error
  }
}
