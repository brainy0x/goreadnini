import { useState, useMemo, useEffect, useRef } from 'react'
import { Upload, Search, X, Settings as SettingsIcon, ArrowUpDown } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import BookCard from '../components/BookCard'
import BookCover from '../components/BookCover'
import BookDetailModal from '../components/BookDetailModal'
import GreetingNames from '../components/GreetingNames'
import SettingsSheet from '../components/SettingsSheet'
import { displayBook, CATEGORIES, categoryOf } from '../lib/bookDisplay'
import { enrichBook, lazyFileLoader } from '../lib/bookEnrich'
import { localizeCover, isRemoteCover } from '../lib/coverCache'

const SHELVES = ['all', 'reading', 'finished']

// left to right: swiping left moves along this list, swiping right moves back
const SECTION_ORDER = ['novel', 'academic', 'all']
const SECTION_LABELS = { novel: 'Novels', academic: 'Academic', all: 'All' }

// How the grid of books can be ordered
const SORTS = [
  { id: 'added',      label: 'Recently added' },
  { id: 'read',       label: 'Recently read' },
  { id: 'title',      label: 'Title A–Z' },
  { id: 'title-desc', label: 'Title Z–A' },
  { id: 'author',     label: 'Author A–Z' },
  { id: 'progress',   label: 'Progress' },
  { id: 'rating',     label: 'Rating' },
  { id: 'finished',   label: 'Date finished' },
]

const byText = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })
const time = (value) => (value ? Date.parse(value) || 0 : 0)

function sortBooks(list, key) {
  const title = (b) => displayBook(b).title
  const author = (b) => displayBook(b).author
  const comparers = {
    added: (a, b) => time(b.created_at) - time(a.created_at),
    read: (a, b) => time(b.last_read_at) - time(a.last_read_at) || time(b.created_at) - time(a.created_at),
    title: (a, b) => byText(title(a), title(b)),
    'title-desc': (a, b) => byText(title(b), title(a)),
    author: (a, b) => {
      // books with no author go last
      if (!author(a) && author(b)) return 1
      if (author(a) && !author(b)) return -1
      return byText(author(a), author(b)) || byText(title(a), title(b))
    },
    progress: (a, b) => (b.progress || 0) - (a.progress || 0),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0),
    finished: (a, b) => time(b.date_finished) - time(a.date_finished),
  }
  return [...list].sort(comparers[key] || comparers.added)
}

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

export default function ShelfPage({ onRead, onNavigate, isMobile }) {
  const { books, loading, updateBook } = useBooks()
  const [activeShelf, setActiveShelf] = useState('all')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [showNames, setShowNames] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Novels | Academic | All, remembered between visits
  const [storedCategory, setCategory] = useState(() => {
    try {
      const saved = localStorage.getItem('grn_library_category')
      return ['novel', 'academic', 'all'].includes(saved) ? saved : 'novel'
    } catch { return 'novel' }
  })
  // On a phone there is no "All" section: it falls back to Novels (the saved choice is left alone)
  const category = isMobile && storedCategory === 'all' ? 'novel' : storedCategory
  const order = isMobile ? ['novel', 'academic'] : SECTION_ORDER
  const [slide, setSlide] = useState('')
  // the chosen order, remembered between visits
  const [sortKey, setSortKey] = useState(() => {
    try {
      const saved = localStorage.getItem('grn_library_sort')
      return SORTS.some(o => o.id === saved) ? saved : 'added'
    } catch { return 'added' }
  })
  const pickSort = (id) => {
    setSortKey(id)
    try { localStorage.setItem('grn_library_sort', id) } catch { /* storage full */ }
  }

  const pickCategory = (id) => {
    if (id === category) return
    setSlide(order.indexOf(id) > order.indexOf(category) ? 'from-right' : 'from-left')
    setCategory(id)
    try { localStorage.setItem('grn_library_category', id) } catch { /* storage full */ }
  }

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
  const triedLocalRef = useRef(new Set())
  const [backfillTick, setBackfillTick] = useState(0)
  useEffect(() => {
    if (loading || runningRef.current) return
    const infoQueue = books.filter(b => !b.lookup_done && !triedRef.current.has(b.id))
    const coverQueue = books.filter(b => b.lookup_done && !b.cover_url && !b.cover_checked && !triedCoverRef.current.has(b.id))
    const localQueue = books.filter(b => isRemoteCover(b.cover_url) && !triedLocalRef.current.has(b.id))
    if (!infoQueue.length && !coverQueue.length && !localQueue.length) return
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
      // covers that are still links to another site: download them once and keep them with the book
      for (const b of localQueue) {
        if (unmountedRef.current) break
        triedLocalRef.current.add(b.id)
        const stored = await localizeCover(b.cover_url)
        if (stored && stored !== b.cover_url) {
          await updateBook(b.id, { cover_url: stored, ...(b.updated_at ? { updated_at: b.updated_at } : {}) })
        }
      }
      runningRef.current = false
      // books that just finished the first stage may now need the cover stage
      if (!unmountedRef.current) setBackfillTick(t => t + 1)
    })()
  }, [loading, books, updateBook, backfillTick])

  // Swipe left/right anywhere on the page to change section (not on rows that scroll sideways)
  const touchRef = useRef(null)
  const onTouchStart = (e) => {
    const t = e.touches[0]
    const blocked = e.target.closest?.('.lib-row, .lib-chips, input, .bd-overlay, .modal-overlay')
    touchRef.current = { x: t.clientX, y: t.clientY, ok: !blocked && t.clientX > 24 }
  }
  const onTouchEnd = (e) => {
    const start = touchRef.current
    touchRef.current = null
    if (!start?.ok || selectedBook || showNames) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return
    const next = order[order.indexOf(category) + (dx < 0 ? 1 : -1)]
    if (next) pickCategory(next)
  }

  const open = (book) => (book.file_path ? onRead(book) : setSelectedBook(book))

  // everything below works on the books of the chosen category
  const catBooks = useMemo(
    () => (category === 'all' ? books : books.filter(b => categoryOf(b) === category)),
    [books, category]
  )
  const categoryCounts = useMemo(() => ({
    all: books.length,
    novel: books.filter(b => categoryOf(b) === 'novel').length,
    academic: books.filter(b => categoryOf(b) === 'academic').length,
  }), [books])
  const studying = category === 'academic'

  const continueBook = useMemo(() => {
    const reading = catBooks.filter(b => b.shelf === 'reading' && b.file_path)
    const started = reading.filter(b => b.progress > 0)
    const pool = started.length ? started : reading
    return [...pool].sort((a, b) => (b.updated_at || '') > (a.updated_at || '') ? 1 : -1)[0]
  }, [catBooks])

  const recent = useMemo(
    () => [...catBooks].sort((a, b) => (b.created_at || '') > (a.created_at || '') ? 1 : -1).slice(0, 10),
    [catBooks]
  )

  const counts = SHELVES.reduce((acc, s) => {
    acc[s] = s === 'all' ? catBooks.length : catBooks.filter(b => b.shelf === s).length
    return acc
  }, {})

  const filtered = catBooks.filter(b => {
    const { title, author } = displayBook(b)
    const q = query.toLowerCase()
    return (activeShelf === 'all' || b.shelf === activeShelf) &&
      (!q || title.toLowerCase().includes(q) || author.toLowerCase().includes(q))
  })

  const shown = sortBooks(filtered, sortKey)
  const showHome = !query && activeShelf === 'all'
  const cont = continueBook && displayBook(continueBook)
  const sectionTitle = showHome ? (category === 'all' ? 'All Books' : `All ${CATEGORIES.find(c => c.id === category).label}`)
    : activeShelf === 'all' ? 'Results'
    : activeShelf.charAt(0).toUpperCase() + activeShelf.slice(1)

  return (
    <div className="lib" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="lib-header">
        <h2 className="lib-title" onClick={onTitleTap}>GoreadNini</h2>
        <div className="lib-actions">
          <button className="lib-icon" onClick={() => setShowSettings(true)} aria-label="Settings">
            <SettingsIcon size={19} />
          </button>
          <button className="lib-icon" onClick={() => { setSearching(s => !s); setQuery('') }} aria-label="Search">
            {searching ? <X size={20} /> : <Search size={20} />}
          </button>
          <button className="lib-icon lib-icon-accent" onClick={() => onNavigate?.('upload')} aria-label="Upload a book">
            <Upload size={19} />
          </button>
        </div>
      </header>

      {!isMobile && (
      <div className="lib-seg lib-seg-pager" role="tablist" aria-label="Library section">
          <span className="lib-seg-thumb" style={{ transform: `translateX(${SECTION_ORDER.indexOf(category) * 100}%)` }} />
          {SECTION_ORDER.map(id => (
            <button
              key={id}
              role="tab"
              aria-selected={category === id}
              className={category === id ? 'active' : ''}
              onClick={() => pickCategory(id)}
            >
              {SECTION_LABELS[id]}
              <small>{categoryCounts[id]}</small>
            </button>
          ))}
        </div>
      )}

      {isMobile && (
        <div className="lib-section-indicator" aria-live="polite">
          <span key={category} className="lib-section-name">
            {SECTION_LABELS[category]}
            <small>{categoryCounts[category]}</small>
          </span>
          <span className="lib-dots" aria-hidden="true">
            {order.map(id => <i key={id} className={id === category ? 'on' : ''} />)}
          </span>
        </div>
      )}

      {searching && (
        <div className="lib-search">
          <Search size={16} />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search title or author..." />
        </div>
      )}

      <div key={category} className={`lib-content ${slide}`}>
      {showHome && continueBook && (
        <section className="lib-section">
          <div className="lib-section-head"><h3>{studying ? 'Continue Studying' : 'Continue Reading'}</h3></div>
          <div className="lib-continue" onClick={() => open(continueBook)}>
            <BookCover book={continueBook} className="lib-continue-cover" />
            <div className="lib-continue-info">
              <div className="lib-continue-title">{cont.title}</div>
              <div className="lib-continue-author">{cont.author || 'Unknown author'}</div>
              <div className="lib-continue-foot">
                <ProgressRing value={continueBook.progress || 0} />
                <span className="lib-continue-btn">{continueBook.progress > 0 ? 'Continue' : (studying ? 'Start studying' : 'Start reading')}</span>
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
              <div className="lib-head-right">
                <span>{filtered.length}</span>
                <label className="lib-sort">
                  <ArrowUpDown size={13} />
                  <span className="lib-sort-label">Sort</span>
                  <select value={sortKey} onChange={e => pickSort(e.target.value)} aria-label="Sort books">
                    {SORTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                </label>
              </div>
            </div>
            {filtered.length > 0 ? (
              <div className="lib-grid">
                {shown.map(b => <BookCard key={b.id} book={b} onClick={() => setSelectedBook(b)} />)}
              </div>
            ) : (
              <div className="lib-empty">
                {catBooks.length === 0
                  ? `Nothing in ${category === 'all' ? 'your library' : CATEGORIES.find(c => c.id === category).label} yet. Tap the upload button to add a book.`
                  : 'No books found.'}
              </div>
            )}
          </section>
        </>
      )}

      </div>

      {showNames && <GreetingNames onClose={() => setShowNames(false)} />}
      {showSettings && <SettingsSheet onClose={() => setShowSettings(false)} />}
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
