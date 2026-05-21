import { useState } from 'react'
import { Search, Plus, Loader } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY || ''

export default function SearchPage() {
  const { addBook, books } = useBooks()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState(null)

  const search = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=12${GOOGLE_API_KEY ? `&key=${GOOGLE_API_KEY}` : ''}`
      const res = await fetch(url)
      const data = await res.json()
      setResults(data.items || [])
    } catch {
      toast('Search failed. Check your connection.', 'error')
    }
    setSearching(false)
  }

  const isInLibrary = (googleId) => books.some(b => b.google_books_id === googleId)

  const handleAdd = async (book, shelf = 'wishlist') => {
    const info = book.volumeInfo
    setAddingId(book.id)
    await addBook({
      title: info.title,
      author: info.authors?.join(', ') || '',
      description: info.description || '',
      cover_url: info.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
      pages_total: info.pageCount || 0,
      genre: info.categories?.join(', ') || '',
      google_books_id: book.id,
      shelf,
    })
    toast(`"${info.title}" added to ${shelf} ✦`, 'success')
    setAddingId(null)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Search & Import</h2>
          <p className="page-subtitle">Discover new books and add them to your collection</p>
        </div>
      </div>

      <div className="page-body">
        {/* Search bar */}
        <div className="search-import-bar" style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', maxWidth: 600 }}>
          <div className="search-wrap" style={{ flex: 1 }}>
            <Search />
            <input
              className="input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Search by title, author, ISBN..."
              autoFocus
            />
          </div>
          <button className="btn btn-primary" onClick={search} disabled={searching}>
            {searching ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Search'}
          </button>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

        {/* Results */}
        {results.length > 0 ? (
          <div className="search-results-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
            {results.map(book => {
              const info = book.volumeInfo
              const cover = info.imageLinks?.thumbnail?.replace('http:', 'https:')
              const inLib = isInLibrary(book.id)
              const loading = addingId === book.id

              return (
                <div key={book.id} className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {cover
                      ? <img src={cover} alt={info.title} style={{ width: 52, height: 72, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />
                      : <div style={{ width: 52, height: 72, background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📖</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.3, marginBottom: '0.25rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{info.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{info.authors?.join(', ')}</div>
                      {info.pageCount && <div style={{ fontSize: '0.7rem', color: 'var(--gold-dim)', marginTop: '0.25rem' }}>{info.pageCount} pages</div>}
                    </div>
                  </div>

                  {info.description && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {info.description}
                    </div>
                  )}

                  {info.categories && (
                    <div style={{ fontSize: '0.68rem', color: 'var(--gold-dim)', fontStyle: 'italic' }}>{info.categories[0]}</div>
                  )}

                  {inLib ? (
                    <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.65rem', color: 'var(--gold)', letterSpacing: '0.1em', paddingTop: '0.25rem' }}>✦ In your library</div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleAdd(book, 'reading')} disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
                        {loading ? '...' : 'Reading'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleAdd(book, 'wishlist')} disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
                        Wishlist
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : searching ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontStyle: 'italic', fontFamily: 'IM Fell English, serif' }}>
            Searching the archives...
          </div>
        ) : (
          <div className="empty-state">
            <Search size={48} />
            <h3>Search the world's books</h3>
            <p>Find any book by title, author, or ISBN and add it to your personal library.</p>
          </div>
        )}
      </div>
    </div>
  )
}
