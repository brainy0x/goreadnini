import { useState, useEffect, useRef } from 'react'
import { Search, Download, Check, BookOpen, Loader } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'
import { saveFile } from '../lib/fileStorage'
import { enrichBook } from '../lib/bookEnrich'
import { localizeCover } from '../lib/coverCache'
import { searchCatalog, downloadCatalogBook, CATALOGS } from '../lib/catalogs'
import BookCover from './BookCover'

const SOURCE_CHIPS = [{ id: 'all', label: 'All sources' }, ...CATALOGS]

export default function CatalogImport({ onRead }) {
  const { books, addBook, updateBook, deleteBook } = useBooks()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('all')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [warning, setWarning] = useState('')
  const [heading, setHeading] = useState('')
  const [busy, setBusy] = useState({}) // sourceId -> status text
  const reqRef = useRef(0)

  const run = async (q, src) => {
    const req = ++reqRef.current
    setSearching(true)
    setWarning('')
    const sources = src === 'all' ? CATALOGS.map(c => c.id) : [src]
    // With no query we show Project Gutenberg's most popular books
    const targets = q ? sources : sources.filter(s => s === 'gutenberg')
    const settled = await Promise.allSettled(targets.map(s => searchCatalog(s, q)))
    if (req !== reqRef.current) return

    const merged = []
    const failed = []
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') merged.push(...r.value)
      else failed.push(CATALOGS.find(c => c.id === targets[i])?.label)
    })
    // Standard Ebooks first when mixing: better formatted editions
    merged.sort((a, b) => (a.source === 'standardebooks' ? -1 : 0) - (b.source === 'standardebooks' ? -1 : 0))
    setResults(merged)
    setHeading(q ? `Results for “${q}”` : 'Popular on Project Gutenberg')
    if (failed.length) setWarning(`Couldn't reach ${failed.join(' and ')}. Check your connection and try again.`)
    setSearching(false)
  }

  useEffect(() => { run('', 'all') }, [])

  const submit = () => run(query.trim(), source)
  const pickSource = (id) => { setSource(id); run(query.trim(), id) }

  const inLibrary = (item) => books.find(b => b.source_id === item.sourceId)

  const importBook = async (item) => {
    const setStatus = (text) => setBusy(p => ({ ...p, [item.sourceId]: text }))
    setStatus('Downloading…')
    let book
    try {
      const file = await downloadCatalogBook(item)
      setStatus('Saving…')
      const cover = await localizeCover(item.cover_url)
      book = await addBook({
        title: item.title,
        author: item.author,
        shelf: 'reading',
        category: 'novel',
        file_name: file.name,
        file_type: 'epub',
        has_file: false,
        source_id: item.sourceId,
        cover_url: cover,
        description: item.description,
        genre: item.genre,
        language: item.language,
      })
      const filePath = await saveFile(book.id, file)
      await updateBook(book.id, { file_path: filePath, has_file: true })
      // Fill in anything still missing (summary, pages…) without blocking
      enrichBook({ ...book, file_path: filePath, has_file: true }, updateBook, { file })
      toast(`"${item.title}" added to your library ✦`, 'success')
    } catch (e) {
      console.error('[CatalogImport] failed:', e)
      if (book) { try { await deleteBook(book.id) } catch { /* nothing to roll back */ } }
      toast(`Couldn't download "${item.title}". Try again in a moment.`, 'error')
    }
    setBusy(p => { const n = { ...p }; delete n[item.sourceId]; return n })
  }

  return (
    <div>
      <div className="lib-search" style={{ marginBottom: '1rem' }}>
        <Search size={16} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Search free books by title or author..."
        />
        <button className="sr-go" onClick={submit} disabled={searching}>
          {searching ? <Loader size={15} className="bd-spin" /> : 'Search'}
        </button>
      </div>

      <div className="lib-chips">
        {SOURCE_CHIPS.map(c => (
          <button key={c.id} className={`lib-chip ${source === c.id ? 'active' : ''}`} onClick={() => pickSource(c.id)}>{c.label}</button>
        ))}
      </div>

      {warning && <div className="sr-warning">{warning}</div>}

      <div className="lib-section-head"><h3>{heading}</h3>{!searching && <span>{results.length}</span>}</div>

      {searching && results.length === 0 ? (
        <div className="lib-empty">Searching the shelves…</div>
      ) : results.length === 0 ? (
        <div className="lib-empty">No free editions found. Try another spelling, or save a site in Bookmarks.</div>
      ) : (
        <div className="lib-grid">
          {results.map(item => {
            const owned = inLibrary(item)
            const status = busy[item.sourceId]
            return (
              <div key={item.sourceId} className="sr-card">
                <BookCover book={{ title: item.title, author: item.author, cover_url: item.cover_url }} />
                <div className="bk-card-title">{item.title}</div>
                <div className="bk-card-author">{item.author || 'Unknown author'}</div>
                <div className="sr-source">{item.source === 'standardebooks' ? 'Standard Ebooks' : 'Gutenberg'}</div>
                {owned ? (
                  owned.file_path ? (
                    <button className="sr-btn sr-btn-ghost" onClick={() => onRead(owned)}><BookOpen size={14} /> Read</button>
                  ) : (
                    <div className="sr-done"><Check size={14} /> In library</div>
                  )
                ) : (
                  <button className="sr-btn" disabled={!!status} onClick={() => importBook(item)}>
                    {status ? <><Loader size={14} className="bd-spin" /> {status}</> : <><Download size={14} /> Add</>}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
