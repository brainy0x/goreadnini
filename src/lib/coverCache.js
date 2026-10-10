// coverCache.js — turn a remote cover link into a small image stored with the book itself,
// so covers load instantly, work offline, sync between devices, and never depend on the source site.

import { shrinkCoverBlob } from './epubCover'

// Sites whose images the browser may read directly; everything else goes through /api/cover
const READABLE = /(^|\.)openlibrary\.org$|(^|\.)archive\.org$/i

export const isRemoteCover = (url) => /^https?:\/\//i.test(url || '')

const fetchWithTimeout = async (url, ms = 20000) => {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { signal: ctrl.signal }) } finally { clearTimeout(timer) }
}

/**
 * Resolves to a small data URL for the cover, or to the original link if it couldn't be stored.
 * Never throws.
 */
export async function localizeCover(url) {
  if (!isRemoteCover(url)) return url
  let host = ''
  try { host = new URL(url).hostname } catch { return url }

  const proxied = `/api/cover?url=${encodeURIComponent(url)}`
  const attempts = READABLE.test(host) ? [url, proxied] : [proxied]

  for (const attempt of attempts) {
    try {
      const res = await fetchWithTimeout(attempt)
      if (!res.ok) continue
      const blob = await res.blob()
      if (!blob.type.startsWith('image/')) continue
      return await shrinkCoverBlob(blob)
    } catch { /* try the next route */ }
  }
  return url
}
