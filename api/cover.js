// Vercel edge function: fetches a book cover image from an allow-listed catalog so the app can read
// it (these sites don't allow browsers to read their images directly) and store it with the book.

import { proxy } from './_proxy.js'

export const config = { runtime: 'edge' }

export default function handler(request) {
  return proxy(request, {
    hosts: ['gutenberg.org', 'standardebooks.org', 'openlibrary.org', 'archive.org'],
    accept: /^image\//i,
    maxBytes: 5 * 1024 * 1024,
    cacheSeconds: 60 * 60 * 24 * 30,
  })
}
