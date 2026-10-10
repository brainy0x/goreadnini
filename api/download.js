// Vercel edge function: fetches an .epub from an allow-listed catalog and streams it back.
// Needed because some catalogs (e.g. Project Gutenberg) do not send CORS headers for file downloads.
// Not an open proxy: only the hosts below, only https, redirects re-checked, epub-ish responses only.

export const config = { runtime: 'edge' }

const ALLOWED_HOSTS = ['gutenberg.org', 'standardebooks.org']
const MAX_BYTES = 40 * 1024 * 1024
const MAX_HOPS = 5

const isAllowed = (url) =>
  url.protocol === 'https:' &&
  ALLOWED_HOSTS.some(h => url.hostname === h || url.hostname.endsWith(`.${h}`))

const fail = (status, message) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

export default async function handler(request) {
  if (request.method !== 'GET') return fail(405, 'Method not allowed')

  let target
  try { target = new URL(new URL(request.url).searchParams.get('url') || '') }
  catch { return fail(400, 'Invalid url') }
  if (!isAllowed(target)) return fail(403, 'Host not allowed')

  let res
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    res = await fetch(target, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (compatible; GoreadNini/1.0)' } })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      target = new URL(res.headers.get('location'), target)
      if (!isAllowed(target)) return fail(403, 'Redirect to a host that is not allowed')
      continue
    }
    break
  }

  if (!res.ok) return fail(502, `Source responded ${res.status}`)

  const type = res.headers.get('content-type') || ''
  if (!/epub|zip|octet-stream/i.test(type)) return fail(415, 'Not an epub file')
  const length = Number(res.headers.get('content-length') || 0)
  if (length > MAX_BYTES) return fail(413, 'File too large')

  return new Response(res.body, {
    headers: {
      'content-type': 'application/epub+zip',
      'cache-control': 'public, max-age=86400',
    },
  })
}
