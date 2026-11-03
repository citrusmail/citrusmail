import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'

const TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff'
}
const MAX_BYTES = 10 * 1024 * 1024

/**
 * Your instance's own files (logo, favicon, sign-in image, custom.css), read
 * from a folder at request time so they can be changed without a rebuild:
 * NUXT_BRAND_DIR, or ./brand next to where the server runs
 */
export function brandDir() {
  return resolve(process.env.NUXT_BRAND_DIR || 'brand')
}

/** A file from the brand folder as a Response, or undefined if there is none */
export async function brandFile(relative: string): Promise<Response | undefined> {
  const root = brandDir()
  const path = resolve(root, relative)
  // Never outside the folder, and only file types a page can use
  if (!path.startsWith(root + sep)) return undefined
  const type = TYPES[extname(path).toLowerCase()]
  if (!type) return undefined
  const info = await stat(path).catch(() => undefined)
  if (!info?.isFile() || info.size > MAX_BYTES) return undefined
  return new Response(new Uint8Array(await readFile(path)), {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      // An SVG opened on its own can't run script on this origin
      'Content-Security-Policy': 'default-src \'none\'; style-src \'unsafe-inline\'; img-src data:; font-src data:'
    }
  })
}
