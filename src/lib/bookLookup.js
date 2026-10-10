// bookLookup.js — fetch summary/cover/pages/language from Open Library for a library entry

const norm = (s = '') => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

// Resolves to a patch of fields (possibly empty if nothing matched). Throws if the lookup failed.
export function lookupBook(title, author) {
  return lookupOpenLibrary(title, author)
}

export function languageName(code) {
  if (!code) return '—'
  try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code } catch { return code }
}

const LANG3 = { eng: 'en', fre: 'fr', ger: 'de', spa: 'es', ita: 'it', por: 'pt', rus: 'ru', jpn: 'ja', chi: 'zh', hin: 'hi' }

async function lookupOpenLibrary(title, author) {
  const params = new URLSearchParams({
    title, limit: '5',
    fields: 'key,title,author_name,cover_i,number_of_pages_median,language,subject,ratings_average',
  })
  if (author) params.set('author', author)
  const res = await fetch(`https://openlibrary.org/search.json?${params}`)
  if (!res.ok) throw new Error(`Open Library ${res.status}`)
  const data = await res.json()

  const want = norm(title)
  const doc = (data.docs || []).find(d => {
    const got = norm(d.title)
    return got && (got.includes(want) || want.includes(got))
  })
  if (!doc) return {}

  const patch = {}
  if (doc.cover_i) patch.cover_url = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
  if (doc.number_of_pages_median) patch.pages_total = doc.number_of_pages_median
  if (doc.language?.length) {
    const code = doc.language.includes('eng') ? 'eng' : doc.language[0]
    patch.language = LANG3[code] || code
  }
  if (doc.ratings_average) patch.public_rating = Math.round(doc.ratings_average * 10) / 10
  if (doc.subject?.length) patch.genre = doc.subject.filter(x => /^[ -~]+$/.test(x)).slice(0, 2).join(', ')
  if (doc.author_name?.length) patch.lookup_author = doc.author_name.join(', ')

  try {
    const wr = await fetch(`https://openlibrary.org${doc.key}.json`)
    if (wr.ok) {
      const w = await wr.json()
      const d = typeof w.description === 'string' ? w.description : w.description?.value
      if (d) patch.description = d.replace(/\s+/g, ' ').trim()
    }
  } catch { /* description is optional */ }
  return patch
}
