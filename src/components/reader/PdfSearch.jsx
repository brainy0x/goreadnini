import { useState, useRef, useEffect } from 'react'
import { X, Search } from 'lucide-react'

const MAX_RESULTS = 150
const PER_PAGE = 3

function snippet(text, index, length) {
  const start = Math.max(0, index - 36)
  const end = Math.min(text.length, index + length + 56)
  return {
    before: (start > 0 ? '…' : '') + text.slice(start, index),
    match: text.slice(index, index + length),
    after: text.slice(index + length, end) + (end < text.length ? '…' : ''),
  }
}

// Find text across the whole document. Page text is cached so a second search is instant.
export default function PdfSearch({ doc, textCache, onGo, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const runId = useRef(0)

  useEffect(() => () => { runId.current += 1 }, [])

  const search = async () => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) { setStatus('Type at least 2 letters'); return }
    const id = ++runId.current
    setBusy(true)
    setResults([])
    const found = []

    for (let n = 1; n <= doc.numPages; n++) {
      if (id !== runId.current) return
      let text = textCache.get(n)
      if (text === undefined) {
        try {
          const page = await doc.getPage(n)
          const content = await page.getTextContent()
          text = content.items.map(item => item.str).join(' ').replace(/\s+/g, ' ')
        } catch {
          text = ''
        }
        textCache.set(n, text)
      }

      const lower = text.toLowerCase()
      let at = lower.indexOf(q)
      let perPage = 0
      while (at !== -1 && perPage < PER_PAGE) {
        found.push({ page: n, ...snippet(text, at, q.length) })
        perPage += 1
        at = lower.indexOf(q, at + q.length)
      }

      if (n % 10 === 0) {
        setStatus(`Searching… page ${n} of ${doc.numPages}`)
        setResults([...found])
        await new Promise(resolve => setTimeout(resolve, 0))
      }
      if (found.length >= MAX_RESULTS) break
    }

    if (id !== runId.current) return
    setResults(found)
    setBusy(false)
    setStatus(found.length ? `${found.length}${found.length >= MAX_RESULTS ? '+' : ''} matches` : 'No matches. Scanned PDFs have no searchable text.')
  }

  return (
    <div className="rd-drawer-wrap" onClick={e => e.target === e.currentTarget && onClose()}>
      <aside className="rd-drawer" role="dialog" aria-label="Search the document">
        <div className="rd-sheet-head">
          <h3>Search</h3>
          <button className="rd-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="pdf-search-box">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Search in this document…"
          />
          <button type="button" onClick={search} disabled={busy && !query.trim()} aria-label="Search"><Search size={16} /></button>
        </div>
        {status && <div className="pdf-search-status">{status}</div>}

        <div className="rd-drawer-body">
          {results.map((r, i) => (
            <button key={`${r.page}-${i}`} className="rd-item-main pdf-hit" onClick={() => onGo(r.page)}>
              <span>
                {r.before}<mark>{r.match}</mark>{r.after}
              </span>
              <small>Page {r.page}</small>
            </button>
          ))}
        </div>
      </aside>
    </div>
  )
}
