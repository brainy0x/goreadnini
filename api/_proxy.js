// Shared by the edge functions in this folder (files starting with "_" are not routes).
// Not an open proxy: only the hosts a caller allows, only https, redirects re-checked at every hop,
// only the content types a caller accepts, and a size cap.

const MAX_HOPS = 5

export const fail = (status, message) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

export async function proxy(request, { hosts, accept, maxBytes, cacheSeconds = 86400, forceType }) {
  if (request.method !== 'GET') return fail(405, 'Method not allowed')

  const isAllowed = (url) =>
    url.protocol === 'https:' &&
    hosts.some(h => url.hostname === h || url.hostname.endsWith(`.${h}`))

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
  if (!accept.test(type)) return fail(415, 'Unsupported file type')
  const length = Number(res.headers.get('content-length') || 0)
  if (length > maxBytes) return fail(413, 'File too large')

  return new Response(res.body, {
    headers: {
      'content-type': forceType || type,
      'cache-control': `public, max-age=${cacheSeconds}`,
    },
  })
}
