import { useState, useMemo, useEffect, useRef } from 'react'
import { Upload, Search, X } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import BookCard from '../components/BookCard'
import BookCover from '../components/BookCover'
import BookDetailModal from '../components/BookDetailModal'
import GreetingNames from '../components/GreetingNames'
import { displayBook } from '../lib/bookDisplay'
import { enrichBook, lazyFileLoader } from '../lib/bookEnrich'

const SHELVES = ['all', 'reading', 'finished', 'wishlist', 'paused']

function ProgressRing({ value }) {
  const r = 20
  const c = 2 * Math.PI * r
  return (
    <div className="bk-ring">
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} className="bk-ring-bg" />
        <circle
          cx="26" cy="26" r={r} className="bk-ring-fg"
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)}
          transform="rotate(-90 26 26)"
        />
      </svg>
      <span>{value}%</span>
    </div>
  )
}

export default function ShelfPage({ onRead, onNavigate }) {
  const { books, loading, updateBook } = useBooks()
  const [activeShelf, setActiveShelf] = useState('all')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [showNames, setShowNames] = useState(false)

  // The greeting-names editor is hidden: tap the GoreadNini title 7 times in quick succession
  const titleTaps = useRef({ n: 0, t: 0 })
  const onTitleTap = () => {
    const now = Date.now()
    const taps = titleTaps.current
    if (now - taps.t > 2000) taps.n = 0
    taps.t = now
    taps.n += 1
    if (taps.n >= 7) { taps.n = 0; setShowNames(true) }
  }
  const [selectedBook, setSelectedBook] = useState(null)

  // Quietly fill in summaries/covers for books that don't have them yet (best effort, one at a time)
  const triedRef = useRef(new Set())
  const runningRef = useRef(false)
  const unmountedRef = useRef(false)
  useEffect(() => () => { unmountedRef.current = true }, [])
  const triedCoverRef = useRef(new Set())
  const [backfillTick, setBackfillTick] = useState(0)
  useEffect(() => {
    if (loading || runningRef.current) return
    const infoQueue = books.filter(b => !b.lookup_done && !triedRef.current.has(b.id))
    const coverQueue = books.filter(b => b.lookup_done && !b.cover_url && !b.cover_checked && !triedCoverRef.current.has(b.id))
    if (!infoQueue.length && !coverQueue.length) return
    runningRef.current = true
    ;(async () => {
      for (const b of infoQueue) {
        if (unmountedRef.current) break
        triedRef.current.add(b.id)
        await enrichBook(b, updateBook)
        await new Promise(r => setTimeout(r, 800))
      }
      // books that still have no cover: look inside the book file itself (once per book)
      for (const b of coverQueue) {
        if (unmountedRef.current) break
        triedCoverRef.current.add(b.id)
        await enrichBook(b, updateBook, { coverOnly: true, loadFile: lazyFileLoader(b) })
        await new Promise(r => setTimeout(r, 800))
      }
      runningRef.current = false
      // books that just finished the first stage may now need the cover stage
      if (!unmountedRef.current) setBackfillTick(t => t + 1)
    })()
  }, [loading, books, updateBook, backfillTick])

  const open = (book) => (book.file_path ? onRead(book) : setSelectedBook(book))

  const continueBook = useMemo(() => {
    const reading = books.filter(b => b.shelf === 'reading' && b.file_path)
    const started = reading.filter(b => b.progress > 0)
    const pool = started.length ? started : reading
    return [...pool].sort((a, b) => (b.updated_at || '') > (a.updated_at || '') ? 1 : -1)[0]
  }, [books])

  const recent = useMemo(
    () => [...books].sort((a, b) => (b.created_at || '') > (a.created_at || '') ? 1 : -1).slice(0, 10),
    [books]
  )

  const counts = SHELVES.reduce((acc, s) => {
    acc[s] = s === 'all' ? books.length : books.filter(b => b.shelf === s).length
    return acc
  }, {})

  const filtered = books.filter(b => {
    const { title, author } = displayBook(b)
    const q = query.toLowerCase()
    return (activeShelf === 'all' || b.shelf === activeShelf) &&
      (!q || title.toLowerCase().includes(q) || author.toLowerCase().includes(q))
  })

  const showHome = !query && activeShelf === 'all'
  const cont = continueBook && displayBook(continueBook)
  const sectionTitle = showHome ? 'All Books'
    : activeShelf === 'all' ? 'Results'
    : activeShelf.charAt(0).toUpperCase() + activeShelf.slice(1)

  return (
    <div className="lib">
      <header className="lib-header">
        <h2 className="lib-title" onClick={onTitleTap}>GoreadNini</h2>
        <div className="lib-actions">
          <button className="lib-icon" onClick={() => { setSearching(s => !s); setQuery('') }} aria-label="Search">
            {searching ? <X size={20} /> : <Search size={20} />}
          </button>
          <button className="lib-icon lib-icon-accent" onClick={() => onNavigate?.('upload')} aria-label="Upload a book">
            <Upload size={19} />
          </button>
        </div>
      </header>

      {searching && (
        <div className="lib-search">
          <Search size={16} />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search title or author..." />
        </div>
      )}

      {showHome && continueBook && (
        <section className="lib-section">
          <div className="lib-section-head"><h3>Continue Reading</h3></div>
          <div className="lib-continue" onClick={() => open(continueBook)}>
            <BookCover book={continueBook} className="lib-continue-cover" />
            <div className="lib-continue-info">
              <div className="lib-continue-title">{cont.title}</div>
              <div className="lib-continue-author">{cont.author || 'Unknown author'}</div>
              <div className="lib-continue-foot">
                <ProgressRing value={continueBook.progress || 0} />
                <span className="lib-continue-btn">{continueBook.progress > 0 ? 'Continue' : 'Start reading'}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="lib-chips">
        {SHELVES.map(s => (
          <button key={s} className={`lib-chip ${activeShelf === s ? 'active' : ''}`} onClick={() => setActiveShelf(s)}>
            {s === 'all' ? 'All Books' : s.charAt(0).toUpperCase() + s.slice(1)}
            <small>{counts[s]}</small>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="lib-grid">
          {Array(6).fill(0).map((_, i) => (
            <div key={i}>
              <div className="skeleton" style={{ width: '100%', aspectRatio: '2/3', borderRadius: 14 }} />
              <div className="skeleton" style={{ height: 12, marginTop: 8, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          {showHome && recent.length > 0 && (
            <section className="lib-section">
              <div className="lib-section-head"><h3>Recently Added</h3></div>
              <div className="lib-row">
                {recent.map(b => <BookCard key={b.id} book={b} onClick={() => setSelectedBook(b)} />)}
              </div>
            </section>
          )}

          <section className="lib-section">
            <div className="lib-section-head">
              <h3>{sectionTitle}</h3>
              <span>{filtered.length}</span>
            </div>
            {filtered.length > 0 ? (
              <div className="lib-grid">
                {filtered.map(b => <BookCard key={b.id} book={b} onClick={() => setSelectedBook(b)} />)}
              </div>
            ) : (
              <div className="lib-empty">No books found.</div>
            )}
          </section>
        </>
      )}

      {showNames && <GreetingNames onClose={() => setShowNames(false)} />}
      {selectedBook && (
        <BookDetailModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onRead={(book) => { setSelectedBook(null); onRead(book) }}
        />
      )}
    </div>
  )
}
