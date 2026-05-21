import { useState } from 'react'
import { Plus, Search, Filter, Grid, List } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import BookCard from '../components/BookCard'
import BookDetailModal from '../components/BookDetailModal'
import AddBookModal from '../components/AddBookModal'

const SHELVES = ['all', 'reading', 'finished', 'wishlist', 'paused']

export default function ShelfPage({ onRead }) {
  const { books, loading } = useBooks()
  const [activeShelf, setActiveShelf] = useState('all')
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [selectedBook, setSelectedBook] = useState(null)
  const [view, setView] = useState('grid')

  const filtered = books.filter(b => {
    const matchShelf = activeShelf === 'all' || b.shelf === activeShelf
    const matchQuery = !query || b.title.toLowerCase().includes(query.toLowerCase()) || (b.author || '').toLowerCase().includes(query.toLowerCase())
    return matchShelf && matchQuery
  })

  const counts = SHELVES.reduce((acc, s) => {
    acc[s] = s === 'all' ? books.length : books.filter(b => b.shelf === s).length
    return acc
  }, {})

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">My Bookshelf</h2>
          <p className="page-subtitle">
            {books.length} {books.length === 1 ? 'tome' : 'tomes'} in your collection
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          <Plus size={13} /> Add Book
        </button>
      </div>

      <div className="page-body">
        {/* Shelf tabs */}
        <div className="shelf-tabs" style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', overflowX: 'auto' }}>
          {SHELVES.map(s => (
            <div
              key={s}
              className={`tab ${activeShelf === s ? 'active' : ''}`}
              onClick={() => setActiveShelf(s)}
              style={{ whiteSpace: 'nowrap' }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              <span style={{ marginLeft: '0.4rem', font: '500 0.6rem "Cinzel", serif', opacity: 0.7 }}>({counts[s]})</span>
            </div>
          ))}
        </div>

        {/* Search bar */}
        <div className="shelf-toolbar" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center' }}>
          <div className="search-wrap" style={{ flex: 1 }}>
            <Search />
            <input
              className="input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search your collection..."
            />
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button className={`btn-icon ${view === 'grid' ? 'btn-primary' : ''}`} onClick={() => setView('grid')} style={{ background: view === 'grid' ? 'var(--gold)' : undefined, color: view === 'grid' ? 'var(--ink)' : undefined }}>
              <Grid size={14} />
            </button>
            <button className={`btn-icon`} onClick={() => setView('list')} style={{ background: view === 'list' ? 'var(--gold)' : undefined, color: view === 'list' ? 'var(--ink)' : undefined }}>
              <List size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="books-grid">
            {Array(8).fill(0).map((_, i) => (
              <div key={i}>
                <div className="skeleton" style={{ width: '100%', aspectRatio: '2/3' }} />
                <div className="skeleton" style={{ height: 12, marginTop: 8, borderRadius: 2 }} />
                <div className="skeleton" style={{ height: 10, marginTop: 4, width: '60%', borderRadius: 2 }} />
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          view === 'grid' ? (
            <div className="books-grid">
              {filtered.map(book => (
                <BookCard key={book.id} book={book} onClick={() => setSelectedBook(book)} />
              ))}
            </div>
          ) : (
            <div className="book-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filtered.map(book => (
                <div
                  key={book.id}
                  className="card"
                  onClick={() => setSelectedBook(book)}
                  style={{ padding: '0.85rem 1rem', cursor: 'pointer', display: 'flex', gap: '1rem', alignItems: 'center' }}
                >
                  {book.cover_url
                    ? <img src={book.cover_url} alt={book.title} style={{ width: 36, height: 52, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />
                    : <div style={{ width: 36, height: 52, background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>📖</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '500 0.9rem "Cinzel", serif', color: 'var(--text-primary)' }}>{book.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{book.author}</div>
                  </div>
                  <div className="book-list-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {book.shelf === 'reading' && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{book.progress || 0}%</span>
                    )}
                    <span className={`shelf-badge ${book.shelf}`}>{book.shelf}</span>
                    {book.rating > 0 && <span style={{ color: 'var(--gold)', fontSize: '0.8rem' }}>{'★'.repeat(book.rating)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h3>Your shelves await</h3>
            <p>No books found. Begin your collection by adding your first tome.</p>
          </div>
        )}
      </div>

      {showAdd && <AddBookModal onClose={() => setShowAdd(false)} />}
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
