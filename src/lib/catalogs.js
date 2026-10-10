// catalogs.js — search free ebook catalogs and download an epub from them.

const fetchWithTimeout = async (url, ms = 15000, init) => {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try { return await fetch(url, { ...init, signal: ctrl.signal }) } finally { clearTimeout(t) }
}

// "Austen, Jane" -> "Jane Austen"
const flipName = (n = '') => {
  if (!n.includes(',')) return n
  const [last, ...rest] = n.split(',')
  return [...rest, last].join(' ').replace(/\s+/g, ' ').trim()
}

export const CATALOGS = [
  { id: 'gutenberg', label: 'Project Gutenberg', hint: '70,000+ public-domain classics' },
  { id: 'standardebooks', label: 'Standard Ebooks', hint: 'Beautifully formatted classics' },
]

async function searchGutenberg(query) {
  const url = query
    ? `https://gutendex.com/books/?search=${encodeURIComponent(query)}`
    : 'https://gutendex.com/books/?languages=en' // no query: most popular
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`Gutenberg ${res.status}`)
  const data = await res.json()
  return (data.results || [])
    .filter(b => b.formats?.['application/epub+zip'])
    .slice(0, 20)
    .map(b => ({
      sourceId: `gutenberg:${b.id}`,
      source: 'gutenberg',
      title: b.title,
      author: (b.authors || []).map(a => flipName(a.name)).join(', '),
      cover_url: b.formats['image/jpeg'] || '',
      description: (b.summaries?.[0] || '').replace(/\s*\(This is an automatically generated summary\.\)\s*$/i, '').trim(),
      genre: (b.subjects || [])[0] || '',
      language: b.languages?.[0] || '',
      downloadUrl: b.formats['application/epub+zip'],
    }))
}

async function searchStandardEbooks(query) {
  const res = await fetchWithTimeout(`https://standardebooks.org/ebooks?query=${encodeURIComponent(query)}&per-page=20`)
  if (!res.ok) throw new Error(`Standard Ebooks ${res.status}`)
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
  return [...doc.querySelectorAll('li[typeof="schema:Book"]')].map(li => {
    const path = li.getAttribute('about')
    const img = li.querySelector('img')?.getAttribute('src')
    return {
      sourceId: `standardebooks:${path}`,
      source: 'standardebooks',
      title: li.querySelector('p a span')?.textContent?.trim() || '',
      author: li.querySelector('.author span')?.textContent?.trim() || '',
      cover_url: img ? new URL(img, 'https://standardebooks.org').href : '',
      description: '',
      genre: '',
      language: 'en',
      downloadUrl: `https://standardebooks.org${path}/downloads/${path.replace('/ebooks/', '').replace(/\//g, '_')}.epub?source=download`,
    }
  }).filter(b => b.title && b.downloadUrl)
}

export function searchCatalog(source, query) {
  return source === 'standardebooks' ? searchStandardEbooks(query) : searchGutenberg(query)
}

// Direct when the host allows browsers to read it, otherwise through our /api/download proxy.
async function tryDownload(url, viaProxyFirst) {
  const viaProxy = () => fetchWithTimeout(`/api/download?url=${encodeURIComponent(url)}`, 90000)
  const direct = () => fetchWithTimeout(url, 90000)
  let lastError
  for (const attempt of viaProxyFirst ? [viaProxy, direct] : [direct, viaProxy]) {
    try {
      const res = await attempt()
      if (!res.ok) throw new Error(`Download failed (${res.status})`)
      const blob = await res.blob()
      const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer())
      // An epub is a zip: must start with "PK"
      if (blob.size < 1000 || head[0] !== 0x50 || head[1] !== 0x4b) throw new Error('Downloaded file is not a valid epub')
      return blob
    } catch (e) {
      lastError = e
    }
  }
  throw lastError || new Error('Download failed')
}

// Project Gutenberg connections drop now and then, so retry and fall back to the lighter text-only edition.
function candidateUrls(item) {
  const urls = [item.downloadUrl, item.downloadUrl]
  if (item.source === 'gutenberg') {
    const id = item.sourceId.split(':')[1]
    urls.push(`https://www.gutenberg.org/ebooks/${id}.epub.noimages`)
  }
  return urls
}

async function fetchEpubBlob(item) {
  const proxyFirst = item.source === 'gutenberg'
  let lastError
  for (const url of candidateUrls(item)) {
    try { return await tryDownload(url, proxyFirst) } catch (e) { lastError = e }
  }
  throw lastError || new Error('Download failed')
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'book'

export async function downloadCatalogBook(item) {
  const blob = await fetchEpubBlob(item)
  return new File([blob], `${slug(item.title)}.epub`, { type: 'application/epub+zip' })
}
