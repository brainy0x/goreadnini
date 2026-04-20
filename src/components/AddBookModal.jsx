import { useState } from 'react'
import { X, Search, Plus, Loader } from 'lucide-react'
import { useBooks } from '../contexts/BooksContext'
import { useToast } from '../contexts/ToastContext'

const SHELVES = ['reading', 'finished', 'wishlist', 'paused']

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY || ''

export default function AddBookModal({ onClose }) {
  const { addBook } = useBooks()
  const toast = useToast()
  const [tab, setTab] = useState('search') // 'search' | 'manual'
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState(null)
  const [shelf, setShelf] = useState('reading')
  const [adding, setAdding] = useState(false)
  const [manualForm, setManualForm] = useState({ title: '', author: '', genre: '', description: '', cover_url: '', pages_total: '' })

  const searchBooks = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8${GOOGLE_API_KEY ? `&key=${GOOGLE_API_KEY}` : ''}`
      const res = await fetch(url)
      const data = await res.json()
      setResults(data.items || [])
    } catch {
      toast('Could not search books. Check your internet.', 'error')
    }
    setSearching(false)
  }

  const handleAdd = async () => {
    setAdding(true)
    if (tab === 'search' && selected) {
      const info = selected.volumeInfo
      await addBook({
        title: info.title,
        author: info.authors?.join(', ') || '',
        description: info.description || '',
        cover_url: info.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
        pages_total: info.pageCount || 0,
        genre: info.categories?.join(', ') || '',
        google_books_id: selected.id,
        shelf,
      })
      toast(`"${info.title}" added to your library ✦`, 'success')
    } else if (tab === 'manual') {
      if (!manualForm.title.trim()) { toast('Please enter a title', 'error'); setAdding(false); return }
      await addBook({
        ...manualForm,
        pages_total: Number(manualForm.pages_total) || 0,
        shelf,
      })
      toast(`"${manualForm.title}" added to your library ✦`, 'success')
    }
    setAdding(false)
    onClose()
  }

  const mf = (field, val) => setManualForm(p => ({ ...p, [field]: val }))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <div className="modal-title">Add Book to Library</div>
          <button className="btn-icon" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="modal-body">
          <div className="tabs">
            <div className={`tab ${tab === 'search' ? 'active' : ''}`} onClick={() => setTab('search')}>Search Google Books</div>
            <div className={`tab ${tab === 'manual' ? 'active' : ''}`} onClick={() => setTab('manual')}>Add Manually</div>
          </div>

          {tab === 'search' ? (
            <>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="search-wrap" style={{ flex: 1 }}>
                  <Search />
                  <input
                    className="input"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchBooks()}
                    placeholder="Search by title, author, ISBN..."
                  />
                </div>
                <button className="btn btn-ghost" onClick={searchBooks} disabled={searching}>
                  {searching ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Search'}
                </button>
              </div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

              {results.length > 0 && (
                <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: '1rem' }}>
                  {results.map(book => {
                    const info = book.volumeInfo
                    const cover = info.imageLinks?.thumbnail?.replace('http:', 'https:')
                    const isSelected = selected?.id === book.id
                    return (
                      <div
                        key={book.id}
                        className="search-result"
                        onClick={() => setSelected(isSelected ? null : book)}
                        style={{ background: isSelected ? 'rgba(201,168,76,0.08)' : undefined, border: isSelected ? '1px solid var(--border-bright)' : '1px solid transparent', borderRadius: 6, marginBottom: 4 }}
                      >
                        {cover
                          ? <img src={cover} alt={info.title} />
                          : <div style={{ width: 48, height: 64, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>📖</div>
                        }
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ font: '500 0.9rem "Cinzel", serif', color: 'var(--text-primary)', marginBottom: 2 }}>{info.title}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{info.authors?.join(', ')}</div>
                          {info.description && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {info.description}
                            </div>
                          )}
                          {info.pageCount && <div style={{ fontSize: '0.72rem', color: 'var(--gold-dim)', marginTop: 3 }}>{info.pageCount} pages</div>}
                        </div>
                        {isSelected && <div style={{ color: 'var(--gold)', fontSize: '1.2rem', alignSelf: 'center' }}>✦</div>}
                      </div>
                    )
                  })}
                </div>
              )}

              {results.length === 0 && !searching && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Search for a book to begin
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Title *</label>
                <input className="input" value={manualForm.title} onChange={e => mf('title', e.target.value)} placeholder="Book title" />
              </div>
              <div className="form-group">
                <label className="form-label">Author</label>
                <input className="input" value={manualForm.author} onChange={e => mf('author', e.target.value)} placeholder="Author name" />
              </div>
              <div className="form-group">
                <label className="form-label">Genre</label>
                <input className="input" value={manualForm.genre} onChange={e => mf('genre', e.target.value)} placeholder="Fantasy, Romance..." />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Cover Image URL</label>
                <input className="input" value={manualForm.cover_url} onChange={e => mf('cover_url', e.target.value)} placeholder="https://..." />
              </div>
              <div className="form-group">
                <label className="form-label">Total Pages</label>
                <input className="input" type="number" value={manualForm.pages_total} onChange={e => mf('pages_total', e.target.value)} placeholder="0" />
              </div>
              <div className="form-group">
                {/* spacer */}
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Description</label>
                <textarea className="input" value={manualForm.description} onChange={e => mf('description', e.target.value)} rows={3} placeholder="What is this book about?" />
              </div>
            </div>
          )}

          {/* Shelf selector - always visible */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <label className="form-label" style={{ marginBottom: '0.6rem' }}>Add to shelf</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {SHELVES.map(s => (
                <button
                  key={s}
                  className={`shelf-badge ${s}`}
                  onClick={() => setShelf(s)}
                  style={{
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    padding: '0.3rem 0.8rem',
                    border: shelf === s ? '1px solid var(--gold)' : undefined,
                    transform: shelf === s ? 'scale(1.05)' : undefined,
                    transition: 'all 0.15s',
                    background: 'none',
                  }}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleAdd}
            disabled={adding || (tab === 'search' && !selected)}
          >
            <Plus size={13} />
            {adding ? 'Adding...' : 'Add to Library'}
          </button>
        </div>
      </div>
    </div>
  )
}
