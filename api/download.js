// Vercel edge function: fetches an .epub from an allow-listed catalog and streams it back.
// Needed because some catalogs (e.g. Project Gutenberg) do not send CORS headers for file downloads.

import { proxy } from './_proxy.js'

export const config = { runtime: 'edge' }

export default function handler(request) {
  return proxy(request, {
    hosts: ['gutenberg.org', 'standardebooks.org'],
    accept: /epub|zip|octet-stream/i,
    forceType: 'application/epub+zip',
    maxBytes: 40 * 1024 * 1024,
    cacheSeconds: 86400,
  })
}
